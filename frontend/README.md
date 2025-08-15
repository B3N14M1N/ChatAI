# ChatAI Frontend (React + TypeScript + Vite)

A glassy, responsive chat UI with authentication, theming, and conversation management for the ChatAI app. Built with React, TypeScript, and Vite.

## Features

- Authentication
  - Register (JSON) and Login (JSON) against FastAPI backend
  - JWT stored in localStorage and auto-attached to all API requests
  - AuthContext provides `login`, `register`, `logout` and current user
  - Protected routes: unauthenticated users are redirected to `/auth/login`
- UI/UX
  - Glassmorphism styling across components
  - Animated chat background on the auth page
  - Theme switcher with persistent theme (via CSS variables + localStorage)
  - Sidebar with conversations list, rename and delete actions
  - Collapsible sidebar with state persisted to localStorage
  - Usage breakdown dropdown for message costs and tokens
  - Attach files when sending messages
  - “Models” dropdown for choosing the chat model
- API helper
  - `src/lib/api.ts` prefixes API requests with `/api` by default (Vite proxy)
  - Automatically adds `Authorization: Bearer <token>` header from localStorage
  - Single place to handle JSON parsing and future 401 handling

## Project structure

```
frontend/
  src/
    App.tsx                 # Main app: sidebar, chat area, conversations
    main.tsx                # App bootstrap + routing + AuthProvider
    pages/
      AuthPage.tsx         # Login/Register screen
    contexts/
      AuthContext.tsx      # JWT auth, user state, login/register/logout
      ThemeContext.tsx     # Theme state + CSS variables
    lib/
      api.ts               # API helper (base URL + Authorization header)
    components/
      Sidebar*.tsx         # Sidebar (header, menu, footer)
      LogoutButton.tsx     # Logout control (matches ThemeSwitcher styling)
      ThemeSwitcher.tsx    # Theme switcher
      ChatArea.tsx         # Chat transcript & message list
      ChatInput.tsx        # Input area with model select & attachments
      ChatBackgroundLoop.tsx  # Animated background for auth page
      UsageDetailsDropdown.tsx # Usage breakdown popup
      ... (styles .css files next to components)
```

## Getting started

Requirements: Node.js (LTS), npm, and the backend running on port 8000.

1) Install dependencies

```powershell
cd frontend
npm install
```

2) Start the dev server (Vite)

```powershell
npm run dev
```

The app will be available at http://localhost:5173. During development, requests to `/api/*` are proxied to the backend at `http://127.0.0.1:8000`.

Backend must be running with the JWT secret configured (see backend README or `JWT_SECRET_KEY`).

## Build and preview

```powershell
npm run build   # Type-check and build
npm run preview # Preview the production build
```

## Configuration

- API base URL
  - By default, the frontend uses `/api` and relies on Vite’s proxy:
    - See `vite.config.ts`:
      - `/api` → `http://127.0.0.1:8000` (path rewritten to remove `/api`)
  - You can override with `VITE_API_BASE` (full URL or path), e.g. when deploying.

- Local storage keys
  - `authToken`: JWT access token
  - `authUser`: cached user info `{ id, email, display_name }`
  - `sidebar.collapsed`: boolean collapsed state for the sidebar

## API calls (frontend expectations)

The frontend calls the following backend endpoints:

- Auth
  - `POST /auth/register` — JSON `{ email, password, display_name? }`
  - `POST /auth/login` — JSON `{ email, password }`
  - `GET /users/me` — returns the authenticated user
- Conversations & Chat
  - `GET /conversations/` — list user conversations
  - `GET /conversations/{id}/messages` — fetch messages for a conversation
  - `PUT /conversations/{id}/rename?new_title=...` — rename a conversation
  - `DELETE /conversations/{id}` — delete a conversation
  - `POST /chat/` — multipart form-data to send a message (with optional files)
  - `GET /chat/messages/{messageId}/usage-details` — usage breakdown for a message
  - `GET /models` — available model list

All requests go through `api.ts` which attaches the `Authorization` header when a token is present.

## Troubleshooting

- 404 Not Found on auth routes during dev
  - Ensure requests go to `/api/auth/...` (the helper handles this by default). The Vite proxy maps `/api` to the backend.

- 401 Unauthorized on `/users/me` right after register/login
  - The app now uses the freshly issued token for the immediate `/users/me` call. If you still see this, check the backend logs and that the token is returned correctly.

- 401s on conversations or chat
  - Confirm you are logged in and a valid `authToken` exists in localStorage. All requests should include the `Authorization` header automatically via `api.ts`.

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — type-check and build
- `npm run preview` — serve the built app locally
- `npm run lint` — run ESLint

---

This frontend is designed to work with the ChatAI FastAPI backend. Make sure the backend is running and reachable at the configured API base.
