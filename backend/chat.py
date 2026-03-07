"""
Chat-Logik: System-Prompt, Prompt-Building, Konversationshistorie.
Unterstützt RAG via ChromaDB.
"""

import json
import logging
from datetime import datetime
from typing import AsyncGenerator
from pathlib import Path
from openai import OpenAI

from config import (
    APP_LM_STUDIO_URL, API_KEY, APP_MODEL_NAME,
    APP_TEMPERATURE, APP_MAX_TOKENS,
    APP_COMPANY_NAME, APP_ASSISTANT_NAME,
)
import memory as mem

logger = logging.getLogger(__name__)

# --- In-Memory Gesprächshistorie pro Session ---
_histories: dict[str, list[dict]] = {}
HISTORY_FILE = Path(__file__).resolve().parent.parent / "data" / "chat_histories.json"

def _load_histories():
    global _histories
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                _histories = json.load(f)
        except Exception as e:
            logger.error(f"Fehler beim Laden der Historien: {e}")

def _save_histories():
    try:
        HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(_histories, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Fehler beim Speichern der Historien: {e}")

# Initiales Laden
_load_histories()

MAX_HISTORY_MESSAGES = 40  # max. Nachrichten pro Session (User + Assistant)


def _build_system_prompt() -> str:
    """Erzeugt den System-Prompt mit aktuellem Datum/Uhrzeit."""
    now = datetime.now()
    datum = now.strftime("%d.%m.%Y")
    uhrzeit = now.strftime("%H:%M")

    return f"""Du bist der interne KI-Assistent von {APP_COMPANY_NAME} (Leibniz-Institut für Informationsinfrastruktur).
Dein Name ist {APP_ASSISTANT_NAME}.

Heute ist {datum}, es ist {uhrzeit} Uhr.

WICHTIGE REGELN (STRENGSTE EINHALTUNG):
1. HALLUZINIERE NICHT: Erfinde niemals Fakten, Daten, Links, Personen, Telefonnummern oder E-Mail-Adressen.
2. NUR INTERNE DATEN: Beantworte Fragen ausschließlich auf Basis der dir zur Verfügung gestellten Informationen.
3. UNSICHERHEIT: Wenn du die Antwort nicht in den bereitgestellten Dokumenten findest oder dir unsicher bist, sage EXAKT: "Dazu liegen mir aktuell keine Informationen vor." oder "Ich weiß es nicht." Erfinde KEINE plausible klingenden Antworten.
4. KEINE QUELLEN-ANGABEN: Nenne in deiner Antwort keine Quellen wie "Auszug 1" oder "Dokument XY". Nutze die Informationen einfach für den Text.

Deine Aufgaben:
- Mitarbeitern bei internen Prozessen, Fragen und Dokumenten helfen.
- Sachlich, freundlich und präzise antworten.

Stil & Formatierung:
- Antworte ausschließlich auf Deutsch.
- Nutze Markdown: **Fett** für Fokus.
- Erzeuge klare Strukturen mit Absätzen (\n\n).
- Überschriften: `### Überschrift`.
- Listen: Bullet-Points (`* `).
- Halte die Einleitung extrem kurz."""


def get_history(session_id: str) -> list[dict]:
    """Gibt die Gesprächshistorie für eine Session zurück."""
    return _histories.get(session_id, [])


def clear_history(session_id: str) -> bool:
    """Löscht die Gesprächshistorie einer Session."""
    if session_id in _histories:
        del _histories[session_id]
        return True
    return False


def _build_messages(session_id: str, user_message: str, user_id: str) -> list[dict]:
    """
    Baut die vollständige Nachrichtenliste für den LLM-Aufruf:
    System-Prompt + RAG-Kontext + Historie + aktuelle Nachricht.
    """
    # System-Prompt
    system_prompt = _build_system_prompt()

    # RAG-Kontext (ChromaDB)
    memory_context = ""
    documents = mem.search_documents(user_message)
    if documents:
        memory_context = "\n\nKontext-Informationen:\n"
        for doc in documents:
            memory_context += f"{doc}\n\n"
        memory_context += "Nutze diesen Kontext für deine Antwort. Erfinde nichts dazu."

    full_system = system_prompt + memory_context

    # Historie abrufen
    history = _histories.get(session_id, [])

    # Nachricht zur Historie hinzufügen
    history.append({"role": "user", "content": user_message})

    # Historie kürzen wenn nötig
    if len(history) > MAX_HISTORY_MESSAGES:
        history = history[-MAX_HISTORY_MESSAGES:]

    _histories[session_id] = history
    _save_histories()

    # Vollständige Nachrichtenliste
    messages = [{"role": "system", "content": full_system}] + history
    return messages


def stream_chat(session_id: str, user_message: str, user_id: str = "default") -> AsyncGenerator[str, None]:
    """
    Streamt die Antwort des LLMs Token für Token.
    """
    client = OpenAI(base_url=APP_LM_STUDIO_URL, api_key=API_KEY)
    messages = _build_messages(session_id, user_message, user_id)

    try:
        response = client.chat.completions.create(
            model=APP_MODEL_NAME,
            messages=messages,
            temperature=APP_TEMPERATURE,
            max_tokens=APP_MAX_TOKENS,
            stream=True,
        )

        full_response = ""
        for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                full_response += token
                yield token

        # Antwort zur Historie hinzufügen
        history = _histories.get(session_id, [])
        history.append({"role": "assistant", "content": full_response})
        _histories[session_id] = history
        _save_histories()

    except Exception as e:
        logger.error(f"LLM-Aufruf fehlgeschlagen: {e}")
        yield f"\n\n⚠️ Fehler bei der Verbindung zum LLM: {str(e)}"


def chat_sync(session_id: str, user_message: str, user_id: str = "default") -> str:
    """Nicht-streamende Variante."""
    chunks = list(stream_chat(session_id, user_message, user_id))
    return "".join(chunks)

def generate_title_sync(user_message: str) -> str:
    """Generates a short title for a chat based on the first user message."""
    client = OpenAI(base_url=APP_LM_STUDIO_URL, api_key=API_KEY)
    
    system_prompt = "Generiere einen sehr kurzen, prägnanten Titel (maximal 4 Wörter) für einen Chat, der mit der folgenden Nachricht beginnt. Antworte NUR mit dem Titel, ohne Anführungszeichen, ohne weitere Erklärungen."
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]

    try:
        response = client.chat.completions.create(
            model=APP_MODEL_NAME,
            messages=messages,
            temperature=0.3,
            max_tokens=20,
        )
        if response.choices and response.choices[0].message.content:
            return response.choices[0].message.content.strip(' "')
    except Exception as e:
        logger.error(f"Titel-Generierung fehlgeschlagen: {e}")
    
    clean = user_message.replace("\n", " ").strip()
    return clean if len(clean) <= 30 else clean[:30] + "…"
