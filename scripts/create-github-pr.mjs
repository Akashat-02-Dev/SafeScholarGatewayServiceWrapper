#!/usr/bin/env node
/**
 * GitHub PR Creator — pushes all gateway files to a new branch and opens a PR.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxxx \
 *   GITHUB_OWNER=yourusername \
 *   GITHUB_REPO=SafeScholar \
 *   node scripts/create-github-pr.mjs
 *
 * Requires a Personal Access Token with `repo` scope (classic) or
 * Contents:write + Pull requests:write (fine-grained).
 *
 * The script uses the GitHub REST API (git database / trees / blobs) to push
 * files directly — no local git clone needed.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER;
const REPO  = process.env.GITHUB_REPO;

if (!TOKEN || !OWNER || !REPO) {
  console.error('❌  Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO env vars.');
  process.exit(1);
}

const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const BRANCH_NAME = 'feat/gateway-integration';
const PR_TITLE = 'feat: add AI gateway integration (lesson planner, quiz, flashcard, scrape, translate)';
const PR_BODY = `## What this PR adds

A unified gateway proxy layer for all AI, scraping, and translation calls.

### Endpoints
- \`POST /api/gateway/ai/lesson-planner\` — generates a structured lesson plan
- \`POST /api/gateway/ai/quiz-generator\` — generates quiz questions
- \`POST /api/gateway/ai/flashcard\` — generates a flashcard deck
- \`POST /api/gateway/scrape\` — scrapes a URL to markdown/html/text
- \`POST /api/gateway/translate\` — translates text (DeepL / Google / LibreTranslate)

### Key features
- API keys stay server-side (never exposed to client)
- Per-user rate limiting (token-bucket via Upstash Redis or in-memory fallback)
- Normalised \`GatewayResponse<T>\` envelope for all responses
- Provider-agnostic — swap providers via env vars, no code changes
- React hooks (\`useLessonPlanner\`, \`useQuizGenerator\`, etc.) for easy UI integration
- Input validation on all endpoints
- NextAuth session-based auth guard

### Files added
See \`docs/GATEWAY_README.md\` for full documentation.

### Setup
1. \`cp .env.example .env.local\` and fill in provider keys
2. Install \`next-auth\`
3. Import hooks in your components — see \`components/dashboard/LessonPlannerPanel.tsx\``;

// ---------------------------------------------------------------------------
// Collect all files to push (everything under the gateway project root)
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.argv[2] || process.cwd();

// Patterns to exclude
const EXCLUDE = new Set(['.git', 'node_modules', '.next', '.env.local', 'scripts/create-github-pr.mjs']);

function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// GitHub git database API flow:
//   1. Get the default branch's commit SHA
//   2. Create blobs for each file
//   3. Build a tree from those blobs
//   4. Create a commit pointing to that tree
//   5. Create (or update) the branch ref
//   6. Open a PR
// ---------------------------------------------------------------------------

async function main() {
  console.log(`📂 Collecting files from ${PROJECT_ROOT}…`);
  const files = collectFiles(PROJECT_ROOT);
  console.log(`   Found ${files.length} files`);

  // 1. Get default branch ref
  console.log('🔍 Fetching default branch…');
  const repoRes = await fetch(`${API}`, { headers: HEADERS });
  if (!repoRes.ok) {
    console.error(`   Failed to fetch repo: ${repoRes.status} ${await repoRes.text()}`);
    process.exit(1);
  }
  const repoInfo = await repoRes.json();
  const defaultBranch = repoInfo.default_branch;

  const refRes = await fetch(`${API}/git/ref/heads/${defaultBranch}`, { headers: HEADERS });
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // 2. Create blobs
  console.log('📦 Creating blobs…');
  const treeItems = [];
  for (const filePath of files) {
    const relPath = relative(PROJECT_ROOT, filePath);
    const content = readFileSync(filePath);
    const blobRes = await fetch(`${API}/git/blobs`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' }),
    });
    const blob = await blobRes.json();
    treeItems.push({ path: relPath, mode: '100644', type: 'blob', sha: blob.sha });
    console.log(`   ✓ ${relPath}`);
  }

  // 3. Create tree
  console.log('🌳 Creating tree…');
  const treeRes = await fetch(`${API}/git/trees`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
  });
  const tree = await treeRes.json();

  // 4. Create commit
  console.log('📝 Creating commit…');
  const commitRes = await fetch(`${API}/git/commits`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: PR_TITLE,
      tree: tree.sha,
      parents: [baseSha],
    }),
  });
  const commit = await commitRes.json();

  // 5. Create or update branch ref
  console.log(`🌿 Creating branch ${BRANCH_NAME}…`);
  const branchCheck = await fetch(`${API}/git/ref/heads/${BRANCH_NAME}`, { headers: HEADERS });
  const branchMethod = branchCheck.ok ? 'PATCH' : 'POST';
  const branchEndpoint = branchCheck.ok
    ? `${API}/git/refs/heads/${BRANCH_NAME}`
    : `${API}/git/refs`;

  const branchBody = branchCheck.ok
    ? JSON.stringify({ sha: commit.sha, force: true })
    : JSON.stringify({ sha: commit.sha, ref: `refs/heads/${BRANCH_NAME}` });

  await fetch(branchEndpoint, {
    method: branchMethod,
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: branchBody,
  });

  // 6. Open PR
  console.log('🔀 Opening pull request…');
  const prRes = await fetch(`${API}/pulls`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: PR_TITLE,
      body: PR_BODY,
      head: BRANCH_NAME,
      base: defaultBranch,
    }),
  });

  if (prRes.status === 422) {
    // PR already exists
    const prData = await prRes.json();
    console.log(`✅ PR already exists: ${prData.message}`);
    const existingPrs = await fetch(`${API}/pulls?head=${OWNER}:${BRANCH_NAME}&state=open`, { headers: HEADERS });
    const prs = await existingPrs.json();
    if (prs[0]) console.log(`   ${prs[0].html_url}`);
    return;
  }

  const pr = await prRes.json();
  if (pr.html_url) {
    console.log(`\n🎉  Success! PR created: ${pr.html_url}\n`);
  } else {
    console.error('   Unexpected response:', JSON.stringify(pr, null, 2));
  }
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
