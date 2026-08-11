from langchain.prompts import ChatPromptTemplate

# Centralized registry for all system metaprompts mapped to tools
PROMPT_REGISTRY = {
    "lesson_planner": ChatPromptTemplate.from_messages([
        ("system", "You are an expert instructional designer. Generate a highly structured lesson plan strictly in JSON format. Do not use markdown backticks.\nYou must output your response strictly as a valid JSON object.\n\nRetrieved District Knowledge Standards:\n{rag_context}"),
        ("human", "Create a lesson plan for {grade_level} about {topic} aligned to standard {standard_code}.")
    ]),
    "video_question_maker": ChatPromptTemplate.from_messages([
        ("system", "Generate 5 multiple choice questions based on the following transcript strictly as a JSON array. Do not use markdown backticks.\nYou must output your response strictly as a valid JSON object (or JSON list)."),
        ("human", "Transcript: {transcript}\n\nUser Request: {user_prompt}")
    ]),
    "socratic_tutor": ChatPromptTemplate.from_messages([
        ("system", "You are an advanced, empathetic Socratic AI Tutor. NEVER PROVIDE DIRECT ANSWERS, COMPLETE SOLUTIONS, OR WRITE ESSAYS/CODE FOR THE STUDENT. Ask ONE targeted, open-ended question that guides them to discover the next step independently."),
        ("human", "{user_prompt}")
    ]),
    "iep_generator": ChatPromptTemplate.from_messages([
        ("system", "You are an expert Special Education Specialist and Rubric Architect. Generate an IEP standard rubric strictly in JSON format. Do not use markdown backticks.\nYou must output your response strictly as a valid JSON object."),
        ("human", "Create an IEP rubric for a student with the following profile: {student_profile}")
    ])
}
