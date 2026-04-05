# Deployment TODO

This is a staging checklist for shipping `arcanagraph` to a DigitalOcean droplet with `pm2`.

## Before Deploying To DigitalOcean

- [ ] Freeze the feature set for the release so deploy work is not happening alongside active merge-conflict or schema churn.
- [ ] Make sure the main gameplay loop works end-to-end in production-like conditions:
  auth -> lobby create/join -> ready up -> start game -> graph battle -> match end -> play again.
- [ ] Run repo checks locally and fix anything red before shipping:
  - `npm run check`
  - `npm --prefix backend test`
  - `npm --prefix frontend run build`
- [ ] Confirm the app no longer depends on Firebase emulators for login in production.
- [ ] Create production env values for the backend:
  - `PORT`
  - `FRONTEND_ORIGIN`
  - `DATABASE_URL`
  - `SESSION_COOKIE_NAME`
  - `SESSION_EXPIRES_DAYS`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
- [ ] Create production env values for the frontend:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - make sure `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` is `false` or removed
  - remove `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL`
- [ ] Decide the production domains/subdomains.
  Suggested split:
  - frontend on `app.your-domain.com` or root domain
  - backend on `api.your-domain.com`
- [ ] Decide where Postgres will live:
  - managed database
  - separate droplet
  - same droplet with Docker/Postgres
- [ ] If using Postgres on the droplet, decide how backups will run before launch.
- [ ] Review CORS/session settings so `FRONTEND_ORIGIN` and cookie behavior match the final domain plan.
- [ ] Confirm websocket traffic is expected in production and note that the reverse proxy must support `socket.io` upgrades.
- [ ] Confirm large/static assets needed by graph battle are present and intentionally deployed:
  - `data/*.csv`
  - `computervision/index.html`
  - `frontend/public/mediapipe/wasm/*`
- [ ] Write down the intended runtime processes for PM2:
  - frontend: `npm --prefix frontend run start`
  - backend: `npm --prefix backend run start`
- [ ] Decide the final internal ports before deploy.
  Suggested:
  - frontend `3000`
  - backend `4000`
- [ ] Plan a simple rollback path:
  - previous git commit/tag
  - previous env files
  - previous PM2 restart target

## On The DigitalOcean Droplet

- [ ] Create a non-root deploy user and disable password SSH if not already done.
- [ ] Add SSH keys for everyone who needs deploy access.
- [ ] Configure firewall rules:
  - allow `22`
  - allow `80`
  - allow `443`
  - do not expose internal app ports publicly unless intentionally needed
- [ ] Install system packages you need:
  - `git`
  - `curl`
  - `nginx`
  - `node`
  - `npm`
  - `pm2`
  - `docker` / `docker compose` if Postgres will run locally
- [ ] Clone the repo onto the droplet.
- [ ] Create production env files on the server:
  - `backend/.env`
  - `frontend/.env.local`
- [ ] Install dependencies:
  - `npm install`
  - `npm --prefix backend install`
  - `npm --prefix frontend install`
- [ ] Bring up Postgres if it is hosted on the droplet.
- [ ] Verify the database is reachable from the backend with the production `DATABASE_URL`.
- [ ] Build the frontend on the droplet:
  - `npm --prefix frontend run build`
- [ ] Start both apps under PM2.
  Suggested names:
  - `arcanagraph-frontend`
  - `arcanagraph-backend`
- [ ] Save PM2 process state with `pm2 save`.
- [ ] Configure PM2 to start on reboot with `pm2 startup`, then run the command it prints.
- [ ] Put Nginx in front of PM2-managed processes.
- [ ] Configure Nginx reverse proxy rules:
  - `/` -> frontend
  - `/api` -> backend
  - socket/websocket upgrade support for backend realtime traffic
- [ ] Add HTTPS with Certbot or your preferred certificate flow.
- [ ] Make sure the public frontend points to the production backend URL, not localhost.

## Immediately After Deploy

- [ ] Verify the backend health endpoint:
  - `GET /api/health`
- [ ] Verify the site loads over HTTPS with no mixed-content errors.
- [ ] Test login with the production Firebase project.
- [ ] Test session persistence after refresh.
- [ ] Test multiplayer flow with two browsers/devices:
  - create lobby
  - join lobby
  - ready up
  - start game
  - graph battle attack loop
  - match resolution
  - play again
- [ ] Confirm websocket events work through Nginx and do not silently fail after connect.
- [ ] Confirm the equation bank loads correctly from `data/advanced_equations.csv`.
- [ ] Confirm MediaPipe assets load correctly in production.
- [ ] Check PM2 logs for both processes:
  - `pm2 logs arcanagraph-frontend`
  - `pm2 logs arcanagraph-backend`
- [ ] Check Nginx logs for proxy or websocket issues.
- [ ] Reboot the droplet once and confirm everything comes back automatically:
  - PM2 processes
  - Nginx
  - Postgres/Docker if applicable
- [ ] Set up PM2 log rotation.
- [ ] Set up a backup plan for the production database.
- [ ] Document the real deploy command sequence your team used once the first deploy succeeds.
- [ ] Create a short incident checklist for future deploys:
  - how to rollback
  - how to restart frontend only
  - how to restart backend only
  - how to inspect logs quickly

## Nice To Have Before Public Launch

- [ ] Add a real production deploy doc with exact PM2 and Nginx commands.
- [ ] Add a checked-in PM2 ecosystem file once the final ports/domains are settled.
- [ ] Add monitoring/uptime alerts for the frontend and `/api/health`.
- [ ] Add automated backups and a restore test for Postgres.
- [ ] Add a manual smoke-test checklist to the repo for each release.
