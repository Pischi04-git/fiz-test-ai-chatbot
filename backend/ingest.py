"""
Liest Markdown-Dokumente aus dem /data/documents Ordner ein,
zerlegt sie in sinnvolle Abschnitte (Chunks) und speichert sie
in der lokalen ChromaDB.
"""

import os
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"

import logging
from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions

# Config-Werte importieren
import sys
sys.path.append(str(Path(__file__).resolve().parent))
from config import CHROMA_DB_PATH

# Logging einrichten
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DOCUMENTS_DIR = Path(__file__).resolve().parent.parent / "data" / "documents"
COLLECTION_NAME = "company_knowledge"

def chunk_text(text: str, max_chars: int = 1000, overlap: int = 100) -> list[str]:
    """
    Zerlegt einen Text in Chunks unter Beibehaltung von Absatzgrenzen.
    """
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""

    for p in paragraphs:
        if len(current_chunk) + len(p) < max_chars:
            current_chunk += p + "\n\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = p + "\n\n"

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks

def ingest_documents():
    """Liest alle .md Dateien ein und indexiert sie."""
    if not DOCUMENTS_DIR.exists():
        logger.error(f"Dokumenten-Verzeichnis existiert nicht: {DOCUMENTS_DIR}")
        return

    # Initalisiere lokalen ChromaDB Client
    client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
    
    # Lokales Embedding-Modell
    sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    try:
        client.delete_collection(name=COLLECTION_NAME)
        logger.info(f"Bestehende Collection '{COLLECTION_NAME}' gelöscht.")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME, 
        embedding_function=sentence_transformer_ef
    )

    documents = []
    metadatas = []
    ids = []
    doc_count = 0

    for file_path in DOCUMENTS_DIR.glob("*.md"):
        logger.info(f"Lese Datei: {file_path.name}")
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        chunks = chunk_text(content)
        for i, chunk in enumerate(chunks):
            doc_id = f"{file_path.stem}_part_{i}"
            documents.append(chunk)
            metadatas.append({"source": file_path.name, "part": i})
            ids.append(doc_id)
        doc_count += 1

    if documents:
        logger.info(f"Indexiere {len(documents)} Chunks aus {doc_count} Dokumenten...")
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        logger.info("✅ Indexierung erfolgreich abgeschlossen!")
    else:
        logger.warning("Keine Markdown-Dokumente zum Indexieren gefunden.")

if __name__ == "__main__":
    ingest_documents()
