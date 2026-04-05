# Arcanagraph

Arcanagraph is a webcam-based math battle game. Players trace graphs in the air with hand tracking, get graded on accuracy, and turn strong scores into damage. The app supports solo practice and multiplayer matches with lobbies, health bars, and rematches.

## What The App Is For

Primary use case:
- make graphing feel like a game by letting players draw functions in the air and cast damage with math accuracy

Secondary use cases:
- solo practice for equation families such as linear, quadratic, cubic, square root, sine, and exponential
- custom practice by selecting a `skill_family` from `data/advanced_equations.csv`
- lightweight player progression with XP, levels, class names, and profile customization

## Current Product Surface

- `Solo mode`
  Practice graph tracing without logging in. Players can jump straight into `/game/solo`.
- `Battle mode`
  Logged-in players can create or join lobbies, ready up, start a match, attack opponents, and play again after a match ends.
- `Hand-tracked graph battle`
  MediaPipe runs in the browser. The selected primary hand is used for tracking. A pointed index finger draws, and an open palm submits for grading.
- `Graph scoring`
  Equation prompts are loaded from CSV data and judged client-side against the target graph.
- `Progression`
  Signed-in users have XP, levels, class names, wins, losses, and a leaderboard presence.
- `Settings`
  Players can choose a primary hand and profile picture. Signed-in users persist settings to Postgres-backed profile data; guests keep hand preference locally in the browser.
- `Demo route`
  `/demo` contains UI and particle-effect sandbox work separate from the main battle flow.

## Routes

- `/`
  Landing page with product pitch and leaderboard
- `/about`
  Product overview
- `/login`
  Firebase auth sign-in flow
- `/play`
  Mode selection and multiplayer lobby flow
- `/game/solo`
  Solo graph practice
- `/game/[lobbyId]`
  Live multiplayer battle room
- `/settings`
  Primary-hand and profile-picture settings
- `/demo`
  Experimental demo UI

## Stack

- `frontend/`
  Next.js app router frontend
- `backend/`
  Express API, Socket.IO game server, Firebase session auth, and Postgres access
- `db/init/`
  PostgreSQL schema bootstrap
- `data/`
  Equation banks, profile-picture catalog, and other game data
- `computervision/`
  Preserved reference implementation for the original CV prototype

Key runtime pieces:
- `Next.js`
- `Express`
- `Socket.IO`
- `PostgreSQL`
- `Firebase Auth`
- `MediaPipe Tasks Vision`

## How Gameplay Works

1. A player chooses solo practice or battle mode.
2. In battle mode, players sign in, create or join a lobby, and ready up.
3. The game loads an equation prompt from CSV-backed graph data.
4. The player traces the graph in the air with their selected primary hand.
5. A passing score above the threshold deals damage based on how close the score is to `100`.
6. Health bars update live until a player reaches zero and the match ends.

## Local Development

### Prerequisites

- `Node.js`
- `npm`
- `Docker` and `docker compose` for local Postgres

### Environment Setup

Copy the example env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

You have two auth options:

- `Firebase emulator`
  Best for fully local battle/auth testing
- `Real Firebase project`
  Supported if you fill in the real frontend and backend Firebase env values

### Start Local Services

Start Postgres:

```bash
npm run db:up
```

Start the Firebase auth emulator if you are using local auth:

```bash
npm run dev:emulator
```

Run frontend and backend together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:frontend
npm run dev:backend
```

## Useful Commands

```bash
npm run dev
npm run check
npm --prefix backend test
npm --prefix frontend run build
```

## Notes For Testing

- Solo mode does not require login.
- Multiplayer battle flow does require auth and a working backend connection.
- Camera permissions are required for graph drawing.
- MediaPipe assets and equation CSVs must be available for the graph battle UI to function correctly.
