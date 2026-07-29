/**
 * Content Guardrail Filter — the first line of defence for the Socratic chat.
 *
 * Every user message passes through `filterMessage()` before it reaches the
 * LLM.  The filter uses two complementary mechanisms:
 *
 *   1. **Pattern-based blocklist** — fast regex matching for obvious
 *      violations (PII leakage, prompt injection, banned topics).
 *   2. **Category classifier** — keyword/semantic scoring to flag content
 *      that falls outside the "academic study help" scope.
 *
 * In production you would also add an LLM-based moderation call (e.g.
 * OpenAI Moderation API) as a third layer — see `moderateWithLLM()`.
 *
 * Design principles:
 *   - Fail-closed: if moderation is unavailable, reject the message.
 *   - No false negatives for high-severity categories.
 *   - Transparent: return a human-readable reason for every block.
 */

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export type Severity = 'block' | 'warn' | 'pass';

export interface FilterResult {
  severity: Severity;
  /** Machine-readable reason code, e.g. "PII_DETECTED". */
  reason: string;
  /** Human-readable explanation shown in logs (never to the user). */
  detail: string;
  /** The sanitized/trimmed message that may proceed (only when severity === 'pass'). */
  sanitized?: string;
}

// ---------------------------------------------------------------------------
// 1. PII (Personally Identifiable Information) detection
// ---------------------------------------------------------------------------

const PII_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, label: 'PHONE_NUMBER' },
  { regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/, label: 'SSN' },
  { regex: /\b\d{16}\b/, label: 'CREDIT_CARD' },
  { regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/, label: 'EMAIL_ADDRESS' },
  { regex: /\b\d{1,5}\s[\w\s]{1,30}(street|st|avenue|ave|road|rd|lane|ln|drive|dr|blvd|boulevard)\b/i, label: 'STREET_ADDRESS' },
  { regex: /\b(\d[.-]?){10,16}\b/, label: 'POSSIBLE_CARD_OR_ID' },
];

// ---------------------------------------------------------------------------
// 2. Prompt-injection patterns
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+(now|actually)\s+(not|a\s+(different|jailbroken))/i,
  /disregard\s+(your|the)\s+(system|initial)\s+(prompt|message|instructions)/i,
  /reveal|show|print|output\s+(your\s+)?(system\s+)?(prompt|instructions|rules)/i,
  /act\s+as\s+if\s+you\s+(are|have)\s+no\s+restrictions/i,
  /act\s+as\s+if\s+you\s+(are\s+)?not\s+(an?\s+)?(ai|tutor|assistant)/i,
  /\b(DAN|do\s+anything\s+now)\b/i,
  /pretend\s+(you\s+(are|have)\s+)?(no|disabled)\s+(restrictions|filters|guidelines)/i,
  /system\s*:\s*/i,
  /\<\/?system\>/i,
  /\<\/?im_(start|end)\>/i,
  /override\s+(your|the|all)\s+(safety|security|content)\s+(guidelines|rules|filters|measures)/i,
];

// ---------------------------------------------------------------------------
// 3. Off-topic category detection
//
// Patterns are *contextual* — they require an action verb or intent marker
// alongside the sensitive keyword, to minimise false positives.
// e.g. "kill" alone is too broad ("To Kill a Mockingbird"), but
// "how to kill someone" or "kill all [group]" is clearly violent intent.
// ---------------------------------------------------------------------------

const OFF_TOPIC_CATEGORIES: { name: string; keywords: RegExp; weight: number }[] = [
  {
    name: 'VIOLENCE_HARM',
    keywords: new RegExp(
      '\\b(' +
        // Direct harm to a person (requires verb + target)
        '(how\\s+to\\s+|ways\\s+to\\s+|best\\s+way\\s+to\\s+)?(kill|murder|assassinate|harm|stab|shoot|torture|poison|poison|injure| hurt)\\s+(someone|people|a\\s+person|him|her|them|others)' +
        '|' +
        // Weapon / explosive manufacturing
        '(how\\s+to\\s+)?(make|build|create|manufacture)\\s+(a\\s+|an\\s+)?(bomb|explosive|explosives|pipe\\s+bomb|mol?otov|grenade|pressure\\s+cooker\\s+bomb)' +
        '|' +
        // Mass violence events
        '(mass\\s+shooting|active\\s+shooter|school\\s+shooting)' +
        '|' +
        // Terrorism planning
        '(terror(ism|ist)\\s+(attack|plot|cell|training|recruit))' +
        '|' +
        // Self-harm intent
        '(suicide\\s+(method|guide|how[- ]?to|ways|tips)|self[- ]?harm\\s+(methods?|guide|how[- ]?to|tips))' +
        ')' +
      '\\b', 'i'
    ),
    weight: 10,
  },
  {
    name: 'ILLEGAL_DRUGS',
    keywords: /\b(how\s+to\s+(make|cook|synth(esize|esize))|buy|sell|traffic(king)?)\s+(drugs|cocaine|heroin|meth|fentanyl|lsd|ecstasy|weed|cannabis|marijuana)\b/i,
    weight: 10,
  },
  {
    name: 'SEXUAL_CONTENT',
    keywords: /\b(porn(ography|ographic)?|nudes?|nudity|explicit\s+sexual|erotic|sexual\s+content|hentai|xxx|onlyfans|nsfw)\b/i,
    weight: 10,
  },
  {
    name: 'HATE_SPEECH',
    keywords: /\b(racial\s+slur|kill\s+all\s+\w+|racial\s+superiority|ethnic\s+cleansing|genocide|nazi\s+(ideology|propaganda)|white\s+(power|supremacy)|neo[- ]?nazi)\b/i,
    weight: 10,
  },
  {
    name: 'MALICIOUS_CODE',
    keywords: /\b(malware|ransomware|trojan\s+horse|keylogger|botnet|ddos\s+attack|sql\s+injection|cross[- ]site\s+scripting|phishing\s+(kit|page|site)|exploit\s+(kit|code|payload)|payload\s+generation|write\s+(me\s+)?a\s+(virus|worm|malware|ransomware|keylogger))\b/i,
    weight: 9,
  },
  {
    name: 'WEAPONS_MANUFACTURING',
    keywords: /\b(3d\s+print(ed|ing)?\s+(gun|firearm|weapon)|how\s+to\s+(build|make|assemble)\s+(a\s+)?(gun|firearm|rifle|pistol|silencer|magazine)|convert\s+.*to\s+(fully\s+)?automatic)\b/i,
    weight: 10,
  },
  {
    name: 'CHEATING_ACADEMIC',
    keywords: /\b(write\s+(my|the|this)\s+(entire|complete|whole|full)\s+(essay|paper|assignment|homework|dissertation|thesis|report)|do\s+my\s+homework|do\s+(my|the)\s+(entire|complete|whole)\s+(assignment|homework|essay|paper|test|exam)\s+for\s+me|take\s+my\s+(exam|test|online\s+exam)|cheat\s+(on|in)\s+(the\s+|an?\s+)?(exam|test|quiz))\b/i,
    weight: 7,
  },
  {
    name: 'GAMBLING',
    keywords: /\b(sports\s+betting|gambling\s+site|casino\s+hack|rigged\s+(slot|machine)|match\s+fixing)\b/i,
    weight: 6,
  },
];

const CATEGORY_THRESHOLD = 6;

// ---------------------------------------------------------------------------
// 4. Conversation-history length limits
// ---------------------------------------------------------------------------

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_HISTORY_CHARS = 30_000;

// ---------------------------------------------------------------------------
// Main filter function
// ---------------------------------------------------------------------------

export function filterMessage(rawMessage: string): FilterResult {
  const message = rawMessage.trim();

  // --- Length check ---
  if (message.length === 0) {
    return { severity: 'block', reason: 'EMPTY_MESSAGE', detail: 'User sent an empty message.' };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      severity: 'block',
      reason: 'MESSAGE_TOO_LONG',
      detail: `Message is ${message.length} chars; max is ${MAX_MESSAGE_LENGTH}.`,
    };
  }

  // --- PII check ---
  for (const { regex, label } of PII_PATTERNS) {
    if (regex.test(message)) {
      return {
        severity: 'block',
        reason: `PII_DETECTED:${label}`,
        detail: `Message contains potential ${label.replace(/_/g, ' ').toLowerCase()}.`,
      };
    }
  }

  // --- Prompt-injection check ---
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        severity: 'block',
        reason: 'PROMPT_INJECTION',
        detail: `Message matches injection pattern: ${pattern.source.slice(0, 80)}`,
      };
    }
  }

  // --- Off-topic category scoring ---
  let maxScore = 0;
  let topCategory = '';
  for (const cat of OFF_TOPIC_CATEGORIES) {
    if (cat.keywords.test(message)) {
      if (cat.weight > maxScore) {
        maxScore = cat.weight;
        topCategory = cat.name;
      }
    }
  }

  if (maxScore >= CATEGORY_THRESHOLD) {
    return {
      severity: 'block',
      reason: `OFF_TOPIC:${topCategory}`,
      detail: `Message scored ${maxScore} in category ${topCategory} (threshold: ${CATEGORY_THRESHOLD}).`,
    };
  }

  // All checks passed
  return { severity: 'pass', reason: 'OK', detail: 'Message passed all guardrail checks.', sanitized: message };
}

// ---------------------------------------------------------------------------
// Conversation history sanitiser
// ---------------------------------------------------------------------------

export interface SocraticMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Trims and sanitises the conversation history array before sending to the LLM.
 *
 * Removes any user message that fails the guardrail filter AND any assistant
 * reply that immediately followed a blocked user message (since that reply
 * was a refusal, not real tutoring content).
 */
export function sanitizeHistory(messages: SocraticMessage[]): SocraticMessage[] {
  // Cap number of messages
  let trimmed = messages.slice(-MAX_HISTORY_MESSAGES);

  // Identify which user messages are blocked, and remove them + the assistant
  // reply that directly follows.
  const result: SocraticMessage[] = [];
  let skipNextAssistant = false;

  for (const msg of trimmed) {
    if (msg.role === 'user') {
      const filterResult = filterMessage(msg.content);
      if (filterResult.severity === 'block') {
        skipNextAssistant = true;
        continue; // drop this user message
      }
      result.push(msg);
      skipNextAssistant = false;
    } else {
      // Assistant message
      if (skipNextAssistant) {
        skipNextAssistant = false;
        continue; // drop the assistant reply to a blocked user message
      }
      result.push(msg);
    }
  }

  // Cap total character count
  let totalChars = result.reduce((sum, m) => sum + m.content.length, 0);
  while (totalChars > MAX_HISTORY_CHARS && result.length > 2) {
    const removed = result.shift()!;
    totalChars -= removed.content.length;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Optional: LLM-based moderation (OpenAI Moderation API)
// ---------------------------------------------------------------------------

/**
 * Calls the OpenAI Moderation API as an additional layer.
 * Use this in production for high-stakes deployments.
 *
 * Returns `true` if the message is flagged.
 */
export async function moderateWithLLM(
  message: string,
  apiKey: string,
): Promise<{ flagged: boolean; categories: string[] }> {
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: message }),
    });

    if (!res.ok) {
      return { flagged: true, categories: ['MODERATION_UNAVAILABLE'] };
    }

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) {
      return { flagged: true, categories: ['MODERATION_PARSE_ERROR'] };
    }

    const flaggedCategories = Object.entries(result.categories || {})
      .filter(([, flagged]: [string, unknown]) => flagged === true)
      .map(([cat]) => cat);

    return { flagged: result.flagged === true, categories: flaggedCategories };
  } catch {
    return { flagged: true, categories: ['MODERATION_ERROR'] };
  }
}
