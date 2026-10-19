# Open Seldon — Claude Code Context

## Project Structure

```
open-seldon/
├── web/          Next.js 15 frontend (deck.gl + MapLibre map dashboard)
├── api/          Python FastAPI backend
├── docker-compose.yml          Base services (postgres, api, caddy)
├── docker-compose.prod.yml     Production overlay (exposes ports 80/443)
├── docker-compose.local.yml    Local dev overlay
└── .github/workflows/          CI + auto-deploy
```

## Architecture

- **Frontend**: Next.js on **Vercel** — auto-deploys when `master` branch is pushed
- **Backend**: Python API + pgvector/Postgres + Caddy, running on **Hetzner** via Docker Compose
- **Local branch**: `main` → push to remote `master` with `git push origin HEAD:master`

## Common Commands

### Frontend dev
```bash
cd web && npm run dev        # start Next.js at localhost:3000
```
The in-app dev server is named `web-dev` in `.claude/launch.json`.

### TypeScript check
```bash
cd web && npx tsc --noEmit
```

### Clear Next.js build cache (when HMR gets stuck)
```powershell
Remove-Item -Recurse -Force web\.next -ErrorAction SilentlyContinue
```
Then restart the dev server.

### Push
```bash
git push origin HEAD:master
```
Always push to `master` — Vercel watches that branch.

### Backend (local)
```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

### Backend logs
```bash
docker compose logs -f openseldon-api
```

## Permissions

Claude may push to `origin/master` on this repo without asking first.

## Deploy

After pushing, Vercel auto-deploys the frontend. The Hetzner backend is updated
by the `deploy.yml` GitHub Actions workflow (SSH pull + docker compose up --build).
