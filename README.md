# ChatAI

ChatAI is a full-stack chat application that uses OpenAI’s LLM API to simulate a ChatGPT-like experience. It supports:
- Persistent conversations stored in async SQLite
- File attachments (PDF, DOCX, CSV) with re-download feature
- Model switching and request metrics (tokens & cost)

Tech Stack
- Backend: Python, FastAPI, Uvicorn, Pydantic, async SQLite, OpenAI API, PyPDF2, python-docx, CSV
- Frontend: React, Vite, TypeScript

Project Structure
```
backend/      FastAPI service
  app/
    main.py   entry point
    core/     config, DB, CRUD, schemas
    services/ chat logic, file processing, pricing
frontend/     React + Vite client
  src/        components, styles, types
```

Prerequisites
- Python 3.10+  Node.js LTS

Installation & Run
1. Backend (PowerShell):
   ```powershell
   cd backend
   python -m venv .venv; .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
2. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Open http://localhost:5173 to start chatting.