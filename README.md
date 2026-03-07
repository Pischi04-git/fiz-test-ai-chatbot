# 🤖 Firmen-Chatbot – Interner KI-Assistent

> Lokaler KI-Chatbot für interne Mitarbeiterfragen. Läuft vollständig lokal mit LM Studio.

[![Python Version](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ⚡ Schnellstart

```bash
# 1. Abhängigkeiten installieren
pip install -r requirements.txt

# 2. Umgebungsvariablen konfigurieren
copy .env.example app_settings.env
# → Firmennamen & Assistentennamen in app_settings.env anpassen

# 3. LM Studio starten (Port 1234)
# Modell herunterladen und Local Server starten

# 4. Backend starten
cd backend
python main.py

# 5. Frontend öffnen
# Öffne frontend/index.html im Browser
```

## 📋 Voraussetzungen

- **Python 3.11+**
- **LM Studio** – [Download](https://lmstudio.ai/)
  - Modell geladen (z.B. Mistral 7B Instruct)
  - Local Server gestartet auf Port `1234`

## 🔧 Setup

### LM Studio konfigurieren

1. LM Studio starten
2. Modell herunterladen (z.B. `mistral-7b-instruct`)
3. Unter „Local Server" → Server starten auf Port `1234`
4. Testen: `curl http://localhost:1234/v1/models`

### Backend einrichten

```bash
# Abhängigkeiten installieren
pip install -r requirements.txt

# app_settings.env aus Vorlage erstellen
copy .env.example app_settings.env
# → Firmennamen & Assistentennamen anpassen

# Backend starten
cd backend
python main.py
```

Das Backend läuft auf `http://localhost:8000`.

### Frontend öffnen

Die Datei `frontend/index.html` im Browser öffnen.

Alternativ via Python HTTP-Server:
```bash
cd frontend
python -m http.server 3000
```
Dann `http://localhost:3000` im Browser öffnen.

## 🚀 API-Endpunkte

| Endpunkt | Methode | Beschreibung |
|---|---|---|
| `/api/health` | GET | Health-Check |
| `/api/chat` | POST | Chat-Nachricht senden (SSE-Streaming) |
| `/api/chat/{session_id}` | DELETE | Session löschen |
| `/api/chat/{session_id}/history` | GET | Chatverlauf abrufen |

## 📁 Verzeichnisstruktur

```
├── backend/
│   ├── main.py       # FastAPI App
│   ├── chat.py       # Chat-Logik & Prompt-Building
│   ├── memory.py     # Mem0 Integration
│   └── config.py     # Konfiguration
├── frontend/
│   ├── index.html    # Chat-Oberfläche
│   ├── style.css     # Styling
│   └── app.js        # Frontend-Logik
├── data/             # Daten (ChromaDB etc.)
│   └── documents/   # Wissensbasis-Dokumente
├── scripts/          # Hilfsskripte
├── .env.example      # Umgebungsvorlage
└── requirements.txt  # Python-Abhängigkeiten
```

## ⚙️ Konfiguration

Umgebungsvariablen in `app_settings.env`:

| Variable | Beschreibung | Standard |
|---|---|---|
| `APP_LM_STUDIO_URL` | LM Studio API URL | http://localhost:1234/v1 |
| `APP_MODEL_NAME` | Modellname | local-model |
| `APP_COMPANY_NAME` | Firmenname | MeineFirma |
| `APP_ASSISTANT_NAME` | Assistentenname | FirmenBot |
| `APP_TEMPERATURE` | Modell-Temperature | 0.7 |
| `APP_MAX_TOKENS` | Max. Token | 2048 |

## 📝 Wissensbasis erweitern

Dokumente im Ordner `data/documents/` ablegen:

- `hr_richtlinien.md` – HR-Richtlinien
- `it_support.md` – IT-Support
- `reisekosten.md` – Reisekosten
- `unternehmen.md` – Unternehmensinfo

## 🐛 Bekannte Probleme

- LM Studio muss auf Port 1234 laufen
- Bei Fehlern: LM Studio Server neustarten

---

*Automat generiert für GitHub*
