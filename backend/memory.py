"""
Memory-Modul mit ChromaDB (RAG).
Stellt Funktionen zur Verfügung, um Relevantes Wissen aus
der lokalen Vektordatenbank abzufragen.
"""

import logging
from typing import Optional
from pathlib import Path
import os

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"

from config import CHROMA_DB_PATH

logger = logging.getLogger(__name__)

_collection = None
_db_available = False
COLLECTION_NAME = "company_knowledge"

def _get_collection():
    """Initialisiert den ChromaDB Client lazy."""
    global _collection, _db_available

    if _collection is not None:
        return _collection

    try:
        import chromadb
        from chromadb.utils import embedding_functions

        client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
        
        sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        
        _collection = client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=sentence_transformer_ef
        )
        _db_available = True
        logger.info("✅ ChromaDB erfolgreich verbunden und Collection geladen")
        return _collection

    except Exception as e:
        _db_available = False
        logger.warning(f"⚠️ ChromaDB Collection nicht gefunden oder Fehler. Bitte 'python ingest.py' ausführen. Fehler: {e}")
        return None


def search_documents(query: str, limit: int = 3) -> list[str]:
    """
    Sucht die relevantesten Dokument-Ausschnitte für eine Anfrage.
    """
    col = _get_collection()
    if col is None:
        return []

    try:
        results = col.query(
            query_texts=[query],
            n_results=limit
        )
        
        documents = []
        if results and "documents" in results and results["documents"]:
            # results["documents"] ist eine Liste von Listen (pro query_text eine)
            for doc in results["documents"][0]:
                documents.append(doc)
            
        logger.info(f"🔍 {len(documents)} relevante Ausschnitte in der DB gefunden für: '{query}'")
        return documents
        
    except Exception as e:
        logger.error(f"Fehler bei ChromaDB-Suche: {e}")
        return []

def is_available() -> bool:
    """Prüft, ob die Datenbank einsatzbereit ist."""
    _get_collection()
    return _db_available
