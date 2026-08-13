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

```

