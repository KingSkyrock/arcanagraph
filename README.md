# arcanagraph

Hackathon-ready Next.js frontend plus Express auth API.

Player progression now includes:

- `xp`
- `level`
- derived class ranks:
  `Spark`, `Ember`, `Adept`, `Enchanter`, `Spellbinder`, `Sorcerer`, `Warlock`

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

## User progression

Users now include `xp` and `level` in Postgres.

The backend derives a class rank from level:

- Level `1`: `Spark`
- Levels `2-4`: `Ember`
- Levels `5-9`: `Adept`
- Levels `10-14`: `Enchanter`
- Levels `15-19`: `Spellbinder`
- Levels `20-29`: `Sorcerer`
- Levels `30+`: `Warlock`

## GitHub safety

Commit the code, schema, and Docker config.

Do not commit:

- `.env` files
- Firebase service account JSON files
- local Postgres data directories or dumps
- local emulator artifacts
