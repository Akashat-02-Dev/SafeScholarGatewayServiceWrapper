# Error Ledger

### PHASE 2
**Component:** HTTP POST /api/v1/ai/student/writing-feedback
**Status Code:** Connection Aborted
**Description:** Gateway brutally dropped connection without HTTP response on large payload
```json
('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
```

### PHASE 3
**Component:** HTTP POST /api/v1/ai/student/writing-feedback
**Status Code:** 200
**Description:** RBAC failure. Endpoint did not return 401 Unauthorized for invalid token
```json
{"response_text":"{\"feedback_points\":[{\"category\":\"Grammar\",\"comment\":\"The sentence joins multiple independent clauses with commas, creating a comma splice. Separate the information into distinct sentences or use appropriate coordinating punctuation.\"},{\"category\":\"Structure\",\"comment\":\"Consider presenting the details in a clearer order or format so the name, phone number, and location are easy to identify.\"},{\"category\":\"Voice and privacy\",\"comment\":\"The tone is direct and factual. Include the phone number only if it is necessary for the assignment or audience, since personal contact information should be shared cautiously.\"}]}","model_used":"gpt-5.5-mini","tokens":{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}}

```

### PHASE 3
**Component:** HTTP POST /api/v1/ai/student/writing-feedback
**Status Code:** 200
**Description:** RBAC failure. Endpoint did not return 401 Unauthorized for invalid token
```json
{"response_text":"{\"feedback_points\":[{\"category\":\"Grammar\",\"comment\":\"The sentence joins multiple independent clauses with commas, creating a comma splice. Separate the information into distinct sentences or use appropriate coordinating punctuation.\"},{\"category\":\"Structure\",\"comment\":\"Consider presenting the details in a clearer order or format so the name, phone number, and location are easy to identify.\"},{\"category\":\"Voice and privacy\",\"comment\":\"The tone is direct and factual. Include the phone number only if it is necessary for the assignment or audience, since personal contact information should be shared cautiously.\"}]}","model_used":"gpt-5.5-mini","tokens":{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}}


### RAG MULTI-TENANCY & GROUNDING VERIFICATION (PHASE 4 MANDATE)
**Component:** Go Gateway + Python AI Orchestrator RAG Pipeline
**Status:** ALL 3 TEST VECTORS PASSED (3/3)

```markdown
[x] Test 1 (Data Isolation): Upload "Document A" to District 1. Log in as a Teacher from District 2. Ask a highly specific question about Document A.
Pass Condition Met: The system returned "This information is not covered in the current district policies. Please consult your administration.", and retrieve_district_context returned 0 results for District 2. LLM execution short-circuited with model_used="none" and 0 tokens.

[x] Test 2 (Grounding/Hallucination Check): Ask the bot a general knowledge question ("What is the capital of France?") while logged into an active district.
Pass Condition Met: The bot refused to answer the question, returning "This information is not covered in the current district policies. Please consult your administration.", proving world-knowledge has been successfully suppressed.

[x] Test 3 (IDOR Bypass Attempt): Attempt to send a POST request with {"institution_id": "DISTRICT_1_ID"} in JSON body while authenticated with a District 2 JWT token / header.
Pass Condition Met: The Go Gateway and Python Orchestrator ignored the JSON body institution_id, enforced the JWT context (District 2), and executed the search against District 2's isolated context.
```

