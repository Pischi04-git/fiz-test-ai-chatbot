"""
Zentrale Konfiguration für den Firmen-Chatbot.
Lädt Einstellungen aus .env-Datei oder verwendet Standardwerte.
"""

import os
from pathlib import Path
from dotenv import dotenv_values

# app_settings.env aus dem Projekt-Root laden
env_path = Path(__file__).resolve().parent.parent / "app_settings.env"
_config = dotenv_values(env_path)

def get_env(key: str, default: str = None) -> str:
    """Get a value from .env or os.environ or return default."""
    return _config.get(key) or os.getenv(key) or default

# --- LM Studio ---
APP_LM_STUDIO_URL = get_env("APP_LM_STUDIO_URL", "http://localhost:1234/v1")
APP_MODEL_NAME = get_env("APP_MODEL_NAME", "local-model")
API_KEY = "lm-studio"  # Beliebiger Wert, wird von LM Studio nicht geprüft

# --- Modell-Parameter ---
APP_TEMPERATURE = float(get_env("APP_TEMPERATURE", "0.7"))
APP_MAX_TOKENS = int(get_env("APP_MAX_TOKENS", "2048"))

# --- Firmen-Identität ---
APP_COMPANY_NAME = get_env("APP_COMPANY_NAME", "FIZ Karlsruhe")
APP_ASSISTANT_NAME = get_env("APP_ASSISTANT_NAME", "FIZ-Assistant")

# --- ChromaDB / Memory ---
CHROMA_DB_PATH = str(Path(__file__).resolve().parent.parent / "data" / "chroma_db")

# --- Server ---
HOST = "0.0.0.0"
PORT = 8000
