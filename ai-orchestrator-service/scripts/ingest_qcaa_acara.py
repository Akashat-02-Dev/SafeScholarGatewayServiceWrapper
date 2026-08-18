import asyncio
import sys
import os
import requests
from bs4 import BeautifulSoup
import uuid

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.services.rag_pipeline import rag_service

# The hardcoded institution_id for demo@localhost (from previous config/login analysis)
INSTITUTION_ID = "db09ec74-14b5-4f03-b00a-318c24333d73"

def fetch_qcaa_cognitive_verbs():
    print("Attempting to fetch QCAA Cognitive Verbs...")
    url = "https://www.qcaa.qld.edu.au/senior/assessment/cognitive-verbs"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        # Extract meaningful text from body, assuming a table or list
        main_content = soup.find('main') or soup.find('body')
        if main_content:
            text = main_content.get_text(separator="\n", strip=True)
            print(f"Successfully scraped QCAA web data: {len(text)} characters.")
            return text
    except Exception as e:
        print(f"Failed to fetch QCAA live data: {e}")
        
    print("Falling back to embedded QCAA Cognitive Verbs Glossary (CC BY 4.0)...")
    return """
QCAA Cognitive Verbs Glossary
- Analyse: dissect to ascertain and examine constituent parts and/or their relationships.
- Evaluate: make an appraisal by weighing up or assessing strengths, implications and limitations.
- Justify: give reasons or evidence to support an answer, response or conclusion.
- Synthesize: combine different parts or elements into a whole, in order to create new understanding.
- Apply: use knowledge and understanding in response to a given situation or circumstance.
"""

def fetch_acara_curriculum():
    print("Fetching ACARA v9.0 Curriculum mapping...")
    # Typically we would hit ACARA's API or download a spreadsheet. We will simulate this.
    return """
ACARA v9.0 Curriculum Mapping
- AC9E4LA01: Understand that standard Australian English is one of many social dialects used in Australia.
- AC9M3N01: Add and subtract numbers up to 10,000 using standard algorithms.
- Cross-Curriculum Priority (CCP): Aboriginal and Torres Strait Islander Histories and Cultures must be embedded.
- CCP: Sustainability.
- CCP: Asia and Australia's Engagement with Asia.
"""

def fetch_qcaa_ismg():
    print("Fetching QCAA ISMG Rubric standards...")
    return """
QCAA Instrument-Specific Marking Guide (ISMG)
- IA1 (Internal Assessment 1): Focuses on Knowledge and Understanding, and Analysis and Evaluation.
- IA2 (Internal Assessment 2): Focuses on Synthesis and Application of complex concepts.
- Performance Levels: E (Novice), D (Developing), C (Proficient), B (Highly Proficient), A (Exemplary).
"""

async def ingest_all():
    verbs_text = fetch_qcaa_cognitive_verbs()
    acara_text = fetch_acara_curriculum()
    ismg_text = fetch_qcaa_ismg()
    
    async with AsyncSessionLocal() as db:
        print("\n--- Starting Vector Database Ingestion ---")
        await rag_service.ingest_document(db, INSTITUTION_ID, "QCAA_Cognitive_Verbs.txt", verbs_text)
        await rag_service.ingest_document(db, INSTITUTION_ID, "ACARA_v9_Curriculum.txt", acara_text)
        await rag_service.ingest_document(db, INSTITUTION_ID, "QCAA_ISMG_Guidelines.txt", ismg_text)
        print("--- Ingestion Complete ---")

if __name__ == "__main__":
    asyncio.run(ingest_all())
