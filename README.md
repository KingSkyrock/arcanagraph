# arcanagraph

Hackathon-ready Next.js frontend plus Express auth API.

## Stack

- `frontend/`: Next.js app router UI
- `backend/`: Express API for Firebase session auth and leaderboard endpoints
- `db/init/`: PostgreSQL schema bootstrap
- `docker-compose.yml`: local Postgres

## Local setup

1. Start Postgres:

```bash
npm run db:up
```

2. Copy env files and fill them in:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

3. Start the Firebase Auth emulator from the repo root:

```bash
npm run dev:emulator
```

4. Run the backend:

```bash
npm run dev:backend
```

5. Run the frontend:

```bash
npm run dev:frontend
```

Or run the full app stack from the repo root:

```bash
npm run dev
```

## Current API

- `POST /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/leaderboard`
- `GET /api/health`

## GitHub safety

Commit the code, schema, and Docker config.

Do not commit:

- `.env` files
- Firebase service account JSON files
- local Postgres data directories or dumps
- local emulator artifacts
