import sys
import os
import requests
import json

BASE_URL = "http://localhost:8000"

def run_tests():
    print("==================================================")
    print("   RAG MULTI-TENANCY & GROUNDING E2E TEST SUITE   ")
    print("==================================================")
    
    passed_tests = 0
    total_tests = 3

    # TEST 1: Data Isolation / Empty Tenant Search
    print("\n[TEST 1] Querying District Knowledge Bot for Tenant with No Chunks...")
    headers = {"X-Institution-Id": "district-tenant-empty-9999"}
    payload = {
        "tool_id": "district_knowledge_bot",
        "institution_id": "district-tenant-empty-9999",
        "parameters": {
            "user_prompt": "What is the district policy on emergency school closure?"
        }
    }
    
    r1 = requests.post(f"{BASE_URL}/v1/ai/educator/district-knowledge-bot", json=payload, headers=headers)
    print(f"Status Code: {r1.status_code}")
    res1 = r1.json()
    print(f"Response Payload: {json.dumps(res1, indent=2)}")
    
    expected_refusal = "This information is not covered in the current district policies. Please consult your administration."
    if r1.status_code == 200 and res1.get("response_text") == expected_refusal and res1.get("model_used") == "none":
        print(">>> TEST 1 PASSED: Data isolation verified. LLM execution short-circuited with zero token usage.")
        passed_tests += 1
    else:
        print(">>> TEST 1 FAILED!")

    # TEST 2: Grounding / Hallucination Suppression Check
    print("\n[TEST 2] Asking General Knowledge Question ('What is the capital of France?')...")
    headers = {"X-Institution-Id": "district-tenant-empty-9999"}
    payload = {
        "tool_id": "district_knowledge_bot",
        "institution_id": "district-tenant-empty-9999",
        "parameters": {
            "user_prompt": "What is the capital of France?"
        }
    }
    
    r2 = requests.post(f"{BASE_URL}/v1/ai/educator/district-knowledge-bot", json=payload, headers=headers)
    print(f"Status Code: {r2.status_code}")
    res2 = r2.json()
    print(f"Response Payload: {json.dumps(res2, indent=2)}")
    
    if r2.status_code == 200 and res2.get("response_text") == expected_refusal:
        print(">>> TEST 2 PASSED: World knowledge suppressed. Bot strictly refused general knowledge query.")
        passed_tests += 1
    else:
        print(">>> TEST 2 FAILED!")

    # TEST 3: IDOR Bypass Attempt (JSON body institution_id vs Header institution_id)
    print("\n[TEST 3] IDOR Bypass Attempt: Sending JSON body institution_id='district-1' with Header X-Institution-Id='district-empty'...")
    headers = {"X-Institution-Id": "district-tenant-empty-9999"}
    payload = {
        "tool_id": "district_knowledge_bot",
        "institution_id": "district-1-unauthorized-target",
        "parameters": {
            "institution_id": "district-1-unauthorized-target",
            "user_prompt": "What is the secret policy?"
        }
    }
    
    r3 = requests.post(f"{BASE_URL}/v1/ai/educator/district-knowledge-bot", json=payload, headers=headers)
    print(f"Status Code: {r3.status_code}")
    res3 = r3.json()
    print(f"Response Payload: {json.dumps(res3, indent=2)}")
    
    if r3.status_code == 200 and res3.get("response_text") == expected_refusal and res3.get("model_used") == "none":
        print(">>> TEST 3 PASSED: IDOR attempt neutralized. Header strictly forced tenant isolation to 'district-tenant-empty-9999'.")
        passed_tests += 1
    else:
        print(">>> TEST 3 FAILED!")

    print(f"\nRESULTS: {passed_tests}/{total_tests} Tests Passed.")
    return passed_tests == total_tests

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
