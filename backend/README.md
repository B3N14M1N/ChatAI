# ChatAI Backend (FastAPI + SQLite + aiosqlite)

FastAPI backend powering the ChatAI application: authentication (JWT), user-scoped conversations, message handling with optional file attachments, usage breakdown and pricing, and a simple RAG pipeline over local book data.

## Features

- Authentication
	- JWT access tokens using `python-jose`
	- Password hashing with `passlib[bcrypt]`
	- Endpoints: `POST /auth/register` (JSON), `POST /auth/login` (JSON), `POST /auth/token` (OAuth2 form), `GET /users/me`
- Users and conversations
	- `users` table; `conversations.user_id` FK; user-scoped CRUD
	- Ownership enforced on conversation APIs
- Chat pipeline
	- Handles user messages, creates conversations, records usage details
	- Optional file attachments stored and downloadable
	- Pricing/usage summary via `GET /chat/messages/{message_id}/usage-details` and conversation-wide variant
	- Profanity filtering: first profane message in a new chat is ignored without creating a conversation; profane messages in existing chats are saved with `ignored=1` and do not trigger an LLM call
- Models catalog
	- `GET /models` returns available chat models derived from `data/pricing_data.json`
- Caching and context
	- Simple TTL cache and conversation context service for compact context building

## Tech stack

- FastAPI
- aiosqlite for async SQLite access
- Pydantic models
- python-jose (JWT), passlib[bcrypt] (password hashing)
- Uvicorn for dev server

## Project layout

```
backend/
	app/
		main.py                 # FastAPI app & endpoints
		data/
			books.json           # RAG source data
			pricing_data.json    # Model pricing data
		db/
			connector.py         # aiosqlite connector
			initializer.py       # Creates DB schema (users, conversations, messages, usage_details, attachments)
			crud.py              # Low-level SQL helpers
			repository.py        # Higher-level operations + ownership checks
		models/
			schemas.py           # Core DB-related Pydantic schemas
			api_schemas.py       # API payloads (RegisterRequest, LoginRequest, etc.)
		services/
			auth.py              # JWT, hashing, get_current_user
			pipelines.py         # Chat pipeline
			pricing.py           # Pricing and usage calculation
			rag.py               # Simple RAG service
			context.py           # Conversation context builder
			cache.py             # TTL cache
			models_catalog.py    # Model listing from pricing data
```

## Setup

1) Create and activate a Python environment (3.12+ recommended).

```powershell
cd backend
python -m venv .venv
./venv/Scripts/activate
```

2) Install dependencies:

```powershell
pip install -r requirements.txt
```

3) Configure environment variables via `.env`:

- Copy `.env.example` to `.env` and adjust values as needed (JWT secret, OpenAI key, etc.).
	The app will read from `.env` on startup.

4) Start the server:

```powershell
uvicorn app.main:app --reload
```

The database will be created on first run at `./app.db`.

## Database schema (high-level)

- users
	- id (PK), email (UNIQUE), password_hash, display_name, created_at
- conversations
	- id (PK), user_id (FK → users.id), title, summary, created_at
- messages
	- id (PK), conversation_id (FK), role, content, created_at
- attachments
	- id (PK), message_id (FK), filename, content_type, blob
- usage_details
	- id (PK), message_id (FK), scope, model, input_tokens, output_tokens, cached_tokens, price

Initializer creates tables if they don’t exist. To reset locally, stop the server and remove `./app.db`.

## Authentication

- Register (JSON): `POST /auth/register`
	- Body: `{ "email": "user@example.com", "password": "secret", "display_name": "User" }`
	- Returns: `{ "access_token": "...", "token_type": "bearer" }`
- Login (JSON): `POST /auth/login`
	- Body: `{ "email": "user@example.com", "password": "secret" }`
	- Returns: `{ "access_token": "...", "token_type": "bearer" }`
- Login (OAuth2 form): `POST /auth/token`
	- Body: `username=<email>&password=<password>`
	- Returns: `{ "access_token": "...", "token_type": "bearer" }`
- Get current user: `GET /users/me`
	- Header: `Authorization: Bearer <token>`

## Conversation & chat endpoints

- List conversations: `GET /conversations/`
	- Auth required; returns only the user’s conversations
- Conversation messages: `GET /conversations/{conversation_id}/messages`
	- Auth required; ownership enforced
- Rename conversation: `PUT /conversations/{conversation_id}/rename?new_title=...`
	- Auth required; ownership enforced
- Delete conversation: `DELETE /conversations/{conversation_id}`
	- Auth required; ownership enforced
- Send message: `POST /chat/`
	- Auth required
	- Multipart form fields:
		- `text` (str, required)
		- `model` (str, optional; default `gpt-4.1-nano`)
		- `conversation_id` (int, optional; omitted for new conversation)
		- `files` (file[], optional)
	- Returns: `{ conversation_id?, request_message_id?, response_message_id?, answer? }`
	  - If the first message of a new chat is profane, no conversation/message is created and all fields may be null.
	  - If a profane message is sent in an existing conversation, the user message is saved with `ignored=1`, no assistant response is created, and `response_message_id`/`answer` are null.
- Message usage details: `GET /chat/messages/{message_id}/usage-details`
	- Returns usage details for a specific message
- Conversation usage details: `GET /chat/{conversation_id}/usage-details`
	- Returns aggregated usage details across messages
- Models catalog: `GET /models`
	- Returns available models derived from pricing data

## Environment variables

- `JWT_SECRET_KEY` (required): secret for signing JWTs
- `JWT_ALGORITHM` (default: `HS256`)
- `JWT_ACCESS_TOKEN_MINUTES` (default: `1440`)

## Development notes

- Ownership checks: most conversation routes accept the user via `Depends(get_current_user)` and validate access in the repository layer.
- The app stores attachments and blobs in SQLite for simplicity. For large files or production, switch to external storage.
- The RAG service (`rag.py`) reads from `data/books.json`. Replace or extend as needed.
- Profanity & context:
	- The pipeline pre-checks for profanity before creating a new conversation. If detected, it short-circuits without any DB writes.
	- In existing conversations, profane user messages are persisted and flagged `ignored=1` (soft removed) and no LLM call is made.
	- The context builder (`services/context.py`) excludes ignored messages to ensure they are never included in prompts.

## Troubleshooting

- 401 Unauthorized
	- Ensure `Authorization: Bearer <token>` is sent. Tokens expire per `JWT_ACCESS_TOKEN_MINUTES`.
	- Verify `JWT_SECRET_KEY` is set before server start.
- 422 on `/auth/register`
	- This endpoint expects JSON. If you send query params, FastAPI returns 422.
- Import errors `jose` or `passlib`
	- Install dependencies: `pip install -r requirements.txt`. For bcrypt, ensure build tools or use the provided wheel on supported platforms.
- Reset local DB
	- Stop the server and delete `backend/data/app.db`. Restart to recreate schema.

## License

See the repository root `LICENSE` file.
