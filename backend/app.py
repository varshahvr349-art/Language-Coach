from flask import Flask,request,jsonify,Response
from flask_cors import CORS
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langgraph.checkpoint.memory import InMemorySaver
from langchain.agents import create_agent
import assemblyai as aai
import os
import base64
import requests
import tempfile
import json

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MURF_API_KEY = os.getenv("MURF_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
aai.settings.api_key = ASSEMBLYAI_API_KEY
checkpointer = InMemorySaver()

model = ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=GROQ_API_KEY
)

agent = create_agent(
    model=model,
    tools=[],
    checkpointer=checkpointer
)

exchange_count = 0
current_language = ""
current_scenario = ""
thread_id = "conversation_session"

LANGUAGE_CODES = {
    "French": "fr",
    "Spanish": "es",
    "Hindi": "hi",
    "Japanese": "ja",
    "German": "de",
    "Telugu": "te",
    "Tamil": "ta"
}

MURF_VOICE_MAP = {
    "French": {"voiceId": "en-US-cooper", "multiNativeLocale": "fr-FR"},
    "Spanish": {"voiceId": "en-US-cooper", "multiNativeLocale": "es-ES"},
    "Hindi": {"voiceId": "en-US-cooper", "multiNativeLocale": "hi-IN"},
    "Japanese": {"voiceId": "en-US-cooper", "multiNativeLocale": "ja-JP"},
    "German": {"voiceId": "en-US-cooper", "multiNativeLocale": "de-DE"},
    "Telugu": {"voiceId": "en-US-cooper", "multiNativeLocale": "en-US"},
    "Tamil": {"voiceId": "en-US-cooper", "multiNativeLocale": "en-US"}
}

SESSION_PROMPT = """You are Nancy, a patient and encouraging language conversation partner helping someone practice {language} through a realistic "{scenario}" scenario.

IMPORTANT GUIDELINES:
1. Conduct exactly 5 conversational exchanges total throughout the session
2. Speak ONLY in {language} for the main conversation
3. After each of your {language} responses, add a correction or tip in English inside [brackets] like:
   [Tip: "Je voudrais" is more polite than "Je veux"]
4. Keep your {language} responses SHORT and CRISP (1-2 sentences maximum)
5. ALWAYS reference what the learner ACTUALLY said in their previous response - do NOT make up or assume their responses
6. Adapt difficulty based on their ACTUAL level - simplify if they struggle, challenge if they're strong
7. Be warm and conversational but CONCISE
8. Stay in the "{scenario}" scenario throughout

CRITICAL: Read the conversation history carefully. Only acknowledge what the learner truly said, not what you think they might have said.

Keep it short, conversational, and adaptive!"""

FEEDBACK_PROMPT = """Based on our complete conversation session, provide detailed feedback as JSON only:
    {{
    "language": "<language practiced>",
    "scenario": "<scenario practiced>",
    "fluency_score": <1-10>,
    "grammar_accuracy": <1-10>,
    "vocabulary_range": "<basic/moderate/advanced>",
    "grammar_mistakes": [
        {{"said": "<what they said>", "correct": "<correct form>", "rule": "<grammar rule>"}}
    ],
    "new_words_to_learn": ["word1", "word2", "word3"],
    "conversation_tip": "<practical tip for improvement>"
    }}
    Be specific - reference ACTUAL things they said during the conversation."""


app = Flask(__name__)

CORS(app, expose_headers=['X-Exchange-Number', 'X-Session-Complete'])
def stream_audio(text):

    # Convert Gemini content list to plain text
    if isinstance(text, list):
        text = "".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in text
        )

    print("Text sent to Murf:", text)

    BASE_URL = "https://global.api.murf.ai/v1/speech/stream"

    voice_config = MURF_VOICE_MAP.get(
        current_language,
        {
            "voiceId": "en-US-cooper",
            "multiNativeLocale": "en-US"
        }
    )

    payload = {
        "text": text,
        "voiceId": voice_config["voiceId"],
        "model": "FALCON",
        "multiNativeLocale": voice_config["multiNativeLocale"],
        "sampleRate": 24000,
        "format": "MP3",
    }

    headers = {
        "Content-Type": "application/json",
        "api-key": MURF_API_KEY
    }

    response = requests.post(
        BASE_URL,
        headers=headers,
        json=payload,
        stream=True
    )

    print("Murf status:", response.status_code)
    print("Murf content-type:", response.headers.get("Content-Type"))

    if response.status_code != 200:
        print("Murf error:")
        print(response.text)
        return

    for chunk in response.iter_content(chunk_size=4096):
        if chunk:
            yield base64.b64encode(chunk).decode("utf-8") + "\n"

@app.route("/start-session", methods=["POST"])
def start_session():
    global exchange_count, current_language, current_scenario, checkpointer, agent
    data = request.json
    current_language = data.get("language", "French")
    current_scenario = data.get("scenario", "ordering food")
    exchange_count = 1
    checkpointer = InMemorySaver()
    agent = create_agent(
        model=model,
        tools=[],
        checkpointer=checkpointer
    )
    config = {"configurable": {"thread_id": thread_id}}
    formatted_prompt = SESSION_PROMPT.format(language=current_language, scenario=current_scenario)
    response = agent.invoke({
        "messages": [
            {"role": "system", "content": formatted_prompt},
            {"role": "user", "content": f"Start the conversation with a warm greeting in {current_language} and set up the '{current_scenario}' scenario. Keep it SHORT (1-2 sentences). Add a [Tip] in English for any key phrase you use."}
        ]
    }, config=config)
    message = response["messages"][-1].content
    print(f"\n[Exchange {exchange_count}] {message}")
    return stream_audio(message), {"Content-Type": "text/plain"}

def speech_to_text(audio_path):
    """Convert audio file to text using AssemblyAI"""
    transcriber = aai.Transcriber()
    lang_code = LANGUAGE_CODES.get(current_language, "en")
    config = aai.TranscriptionConfig(
        speech_models=["universal-3-pro", "universal-2"],
        language_code=lang_code,
        speaker_labels=True,
    )
    transcript = transcriber.transcribe(audio_path, config=config)
    return transcript.text if transcript.text else ""


@app.route("/submit-response", methods=["POST"])
def submit_response():
    """Process user's response and generate next exchange"""
    global exchange_count

    audio_file = request.files["audio"]

    temp_path = tempfile.NamedTemporaryFile(delete=False, suffix=".webm").name
    audio_file.save(temp_path)

    answer = speech_to_text(temp_path)
    os.unlink(temp_path)

    if not answer or answer.strip() == "":
        answer = "[Learner provided a verbal response]"

    print(f"[Response {exchange_count}] {answer}")

    config = {"configurable": {"thread_id": thread_id}}

    agent.invoke({"messages": [{"role": "user", "content": answer}]}, config=config)

    if exchange_count >= 5:
        response = agent.invoke({
            "messages": [{"role": "user", "content": f"That was the 5th exchange. Briefly acknowledge their ACTUAL response in {current_language} and let them know the conversation practice is complete. Keep it SHORT. Add a final [Tip] in English."}]
        }, config=config)

        closing_message = response["messages"][-1].content
        print(f"\n[Closing] {closing_message}")

        return Response(
            stream_audio(closing_message),
            mimetype='text/plain',
            headers={'X-Session-Complete': 'true'}
        )

    exchange_count += 1

    prompt = f"""The learner just responded in exchange {exchange_count - 1}.

Look at their ACTUAL response above. Do NOT assume or make up what they said.

Now continue with exchange {exchange_count} of 5:
1. Briefly acknowledge what they ACTUALLY said in {current_language} (1 sentence)
2. Continue the "{current_scenario}" conversation naturally (1-2 sentences in {current_language})
3. If they struggled or used English, gently guide them back to {current_language} with simpler phrases
4. Add a [Tip] in English about any grammar or vocabulary correction
5. Keep the TOTAL response under 3-4 sentences

Be conversational but CONCISE. Only reference what they truly said."""

    response = agent.invoke({"messages": [{"role": "user", "content": prompt}]}, config=config)

    message = response["messages"][-1].content
    print(f"\n[Exchange {exchange_count}] {message}")

    return Response(
        stream_audio(message),
        mimetype='text/plain',
        headers={'X-Exchange-Number': str(exchange_count)}
    )

@app.route("/get-feedback", methods=["POST"])
def get_feedback():
    """Generate detailed conversation feedback"""

    config = {"configurable": {"thread_id": thread_id}}

    feedback_prompt = f"""
        You are a language learning coach.

        Review the complete {current_language} conversation
        about "{current_scenario}".

        Return ONLY valid JSON:

        {{
            "language": "{current_language}",
            "scenario": "{current_scenario}",
            "fluency_score": 7,
            "grammar_accuracy": 7,
            "vocabulary_range": "moderate",
            "grammar_mistakes": [],
            "new_words_to_learn": [],
            "conversation_tip": ""
        }}

        Rules:
        - Give fluency_score from 1 to 10.
        - Give grammar_accuracy from 1 to 10.
        - vocabulary_range must be basic, moderate, or advanced.
        - Add actual grammar mistakes if any.
        - Add 3 useful new words.
        - Give one short conversation tip.
        - Use only what the learner actually said.
        - Return ONLY JSON.
        """
    response = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": feedback_prompt
                }
            ]
        },
        config=config
    )

    text = response["messages"][-1].content

    # Gemini may return content as a list
    if isinstance(text, list):
        text = "".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in text
        )

    print(f"\n[Feedback Generated]\n{text}\n")

    cleaned = text.strip()

    # Remove markdown code fences if Gemini adds them
    if "```" in cleaned:
        cleaned = cleaned.replace("```json", "")
        cleaned = cleaned.replace("```", "")
        cleaned = cleaned.strip()

    try:
        feedback = json.loads(cleaned)

    except json.JSONDecodeError:
        print("Feedback was not valid JSON:")
        print(cleaned)

        return jsonify({
            "success": False,
            "error": "AI returned invalid feedback format",
            "raw_feedback": cleaned
        }), 500

    return jsonify({
        "success": True,
        "feedback": feedback
    })


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5001))
    )