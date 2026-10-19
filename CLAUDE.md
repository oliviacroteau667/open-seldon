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

- **Frontend**: Next.js on **Vercel** — auto-deploys when `main` is pushed (Vercel production branch = `main`)
- **Backend**: Python API + pgvector/Postgres + Caddy, running on **Hetzner** via Docker Compose
- **Branch**: `main` only. (A legacy `master` branch was deleted 2026-10-19 — never push to it.)

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
git push origin main
```
`deploy.yml` triggers on pushes to `main` (and can be run manually via workflow_dispatch).

### Backend (local)
```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

### Backend (production, on the Hetzner server at /root/open-seldon)
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
Always include `docker-compose.prod.yml` on the server. It is the only file that
publishes Caddy's ports 80/443 — a plain `docker compose up -d` recreates Caddy
with no host ports and takes the whole API offline (this happened 2026-10-19).

### Backend logs
```bash
docker compose logs -f openseldon-api
```

## Permissions

Claude may push to `origin/main` on this repo without asking first.

## Deploy

After pushing, Vercel auto-deploys the frontend. The Hetzner backend is updated
by the `deploy.yml` GitHub Actions workflow (SSH pull + docker compose up --build).
