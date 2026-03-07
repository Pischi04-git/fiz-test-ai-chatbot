"""
FastAPI-Backend für den Firmen-Chatbot.
Stellt REST-API-Endpunkte für den Chat bereit.
"""

import logging
import json
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional

import chat
import memory as mem

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# --- FastAPI App ---
app = FastAPI(
    title="Firmen-Chatbot API",
    description="Interner KI-Assistent – Prototyp",
    version="0.1.0",
)

# CORS für Frontend-Zugriff (lokal)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request/Response Models ---
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    user_id: str = "default"
    stream: bool = True


class ChatResponse(BaseModel):
    response: str
    session_id: str


class TitleRequest(BaseModel):
    message: str


# --- Endpunkte ---
@app.get("/api/health")
async def health_check():
    """Health-Check-Endpunkt."""
    return {
        "status": "ok",
        "memory_available": mem.is_available(),
    }


@app.post("/api/chat/title")
async def generate_title(request: TitleRequest):
    """Generates a title based on the first message."""
    title = chat.generate_title_sync(request.message)
    return {"title": title}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Hauptendpunkt: Nimmt eine Nachricht entgegen und gibt die LLM-Antwort zurück.
    Unterstützt Streaming (SSE) und nicht-streamende Antworten.
    """
    # Fallback für session_id falls null gesendet wurde
    session_id = request.session_id or "default"

    logger.info(
        f"Chat-Anfrage: session={session_id}, "
        f"user={request.user_id}, stream={request.stream}"
    )

    if request.stream:
        def generate():
            for token in chat.stream_chat(
                session_id=session_id,
                user_message=request.message,
                user_id=request.user_id,
            ):
                # SSE-Format: jeder Token als JSON-codiertes data-Event
                yield f"data: {json.dumps(token)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        response_text = chat.chat_sync(
            session_id=session_id,
            user_message=request.message,
            user_id=request.user_id,
        )
        return ChatResponse(response=response_text, session_id=session_id)


@app.delete("/api/chat/{session_id}")
async def clear_session(session_id: str):
    """Löscht die Gesprächshistorie einer Session."""
    deleted = chat.clear_history(session_id)
    if deleted:
        return {"status": "ok", "message": f"Session '{session_id}' gelöscht."}
    return JSONResponse(
        status_code=404,
        content={"status": "error", "message": f"Session '{session_id}' nicht gefunden."},
    )


@app.get("/api/chat/{session_id}/history")
async def get_history(session_id: str):
    """Gibt die Gesprächshistorie einer Session zurück."""
    history = chat.get_history(session_id)
    return {"session_id": session_id, "messages": history}


# --- Statische Dateien (Frontend) ---
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
    logger.info(f"📁 Frontend wird ausgeliefert aus: {frontend_dir}")


# --- Startup ---
if __name__ == "__main__":
    import uvicorn
    from config import HOST, PORT

    logger.info(f"🚀 Starte Firmen-Chatbot auf {HOST}:{PORT}")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
