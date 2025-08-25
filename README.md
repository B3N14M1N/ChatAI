# ChatAI

ChatAI is a full-stack chat application that uses OpenAI's LLM API to simulate a ChatGPT-like experience. It supports:
- Persistent conversations stored in async SQLite
- File attachments (PDF, DOCX, CSV) with re-download feature
- Model switching and request metrics (tokens & cost)
- RAG (Retrieval-Augmented Generation) with ChromaDB for enhanced responses
- Intent detection and conversation context management
- Profanity-aware pipeline that prevents abusive content from being sent to the LLM and excludes ignored messages from context
- **Book recommendations** from a curated dataset of classic literature using the RAG system
 - User accounts with JWT authentication (register/login) and user-scoped conversations
 - Glassy UI with theme switching and a collapsible sidebar

## Book Recommendation Feature

ChatAI includes an intelligent book recommendation system that leverages RAG (Retrieval-Augmented Generation) technology. The system can recommend books from a curated dataset of classic literature including works by:
- George Orwell (*1984*, *Animal Farm*)
- J.R.R. Tolkien (*The Hobbit*, *The Lord of the Rings*)
- Harper Lee (*To Kill a Mockingbird*)
- Jane Austen (*Pride and Prejudice*)
- F. Scott Fitzgerald (*The Great Gatsby*)
- J.K. Rowling (*Harry Potter series*)
- And many other renowned authors

The system only recommends books that exist in its knowledge base, ensuring accurate and detailed information about plot, themes, characters, and publication details.

## Tech Stack
- Backend: Python, FastAPI, Uvicorn, Pydantic, async SQLite, OpenAI API, ChromaDB, PyPDF2, python-docx, CSV, JWT (python-jose), passlib[bcrypt]
- Frontend: React, Vite, TypeScript (animated auth background, theme switcher)

## Project Structure
```
backend/      FastAPI service
  app/
    main.py     entry point
    db/         database connector, CRUD operations, repository
    models/     Pydantic schemas and API models
    services/   chat pipelines, OpenAI gateway, RAG, pricing, caching
    data/       static data files (books.json, pricing_data.json)
frontend/     React + Vite client
  src/        components, styles, types
```

## Prerequisites
- Python 3.10+, Node.js LTS
- OpenAI API Key
- A JWT secret for the backend

## Installation & Run
1. Set OpenAI API Key (PowerShell):
   ```powershell
   setx OPENAI_API_KEY "your-openai-api-key-here"
   ```
   *Note: Restart your terminal after setting the environment variable*

2. Backend (PowerShell):
   ```powershell
   # Setup
   cd backend
   python -m venv .venv
   ./.venv/Scripts/activate
   pip install -r requirements.txt

   # JWT secret (required)
   $env:JWT_SECRET_KEY = "replace_with_a_secure_random_value"

   #Run application
   uvicorn app.main:app --reload
   ```

3. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Open http://localhost:5173 to start chatting and getting book recommendations!

Login/Register at `/auth/login` or `/auth/register`. Once authenticated, conversations and messages are scoped to your account.

### Profanity handling
- New chat: if the first message contains profanity, the backend discards it and does not create a conversation.
- Existing chat: if a message contains profanity, it’s saved with an `ignored` flag; no LLM call is made and the UI displays the message in a subdued style. Ignored messages are excluded from the conversation context used by the LLM.