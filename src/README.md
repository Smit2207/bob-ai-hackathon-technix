# Source Code â€” MedBrief AI

This directory contains all application source code for MedBrief AI.

## Directory Structure

```
src/
â”œâ”€â”€ client/          # React 18 + TypeScript + Vite frontend
â”œâ”€â”€ server/          # Node.js + Express + Prisma backend
â”œâ”€â”€ shared/          # Shared TypeScript clinical engine (zero deps)
â”œâ”€â”€ scripts/         # Development/verification scripts
â”œâ”€â”€ package.json     # Workspace-level scripts
â””â”€â”€ .env.example     # Environment variable reference
```

## Quick Start

See the full [Setup Guide](../docs/setup-guide.md) for detailed instructions.

### Demo Mode (no database required)

```bash
npm install --prefix client
npm run dev:client
# â†’ http://localhost:5173/?demo=1
```

### Live Mode

```bash
npm run install:all
cp server/.env.example server/.env
# Edit server/.env: set DATABASE_URL and JWT_SECRET
npm run prisma:migrate
npm run dev:server   # Terminal 1
npm run dev:client   # Terminal 2
```

## Available Scripts (run from this directory)

| Script | Description |
|--------|-------------|
| `npm run dev:client` | Start Vite dev server (http://localhost:5173) |
| `npm run dev:server` | Start Express dev server (http://localhost:5000) |
| `npm run build:client` | Production build â†’ client/dist/ |
| `npm run build:server` | TypeScript compile â†’ server/dist/ |
| `npm test` | Run all server tests (vitest) |
| `npm run typecheck:client` | TypeScript check on frontend |
| `npm run prisma:migrate` | Initialize/migrate SQLite database |
| `npm run prisma:generate` | Regenerate Prisma client |

## Environment Variables

Copy `server/.env.example` to `server/.env` and fill in the required values.
See `.env.example` for the full variable reference.

**Never commit `server/.env` or any real `.env` file.**