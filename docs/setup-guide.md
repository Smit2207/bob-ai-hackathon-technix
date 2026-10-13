# Setup Guide â€” MedBrief AI

## Prerequisites

- **Node.js** 20.x or higher (`node --version`)
- **npm** 10.x or higher (`npm --version`)
- **Git**

No PostgreSQL or other external database is required â€” the application uses SQLite via Prisma.

---

## Option 1: Demo Mode (Fastest â€” No Database, No Auth)

Demo mode runs the complete clinical engine in the browser with localStorage persistence.
No backend, database, or AI credentials required.

```bash
# Clone the repository
git clone https://github.com/Smit2207/bob-ai-hackathon-technix.git
cd bob-ai-hackathon-technix/src

# Install frontend dependencies only
npm install --prefix client

# Start Vite dev server
npm run dev:client
# â†’ http://localhost:5173
```

Visit **http://localhost:5173/?demo=1** to enter demo mode with pre-loaded patients.

---

## Option 2: Full Live Mode (With Database and Authentication)

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/Smit2207/bob-ai-hackathon-technix.git
cd bob-ai-hackathon-technix/src

# Install both client and server dependencies
npm run install:all
# or separately:
# npm install --prefix client
# npm install --prefix server
```

### 2. Configure Server Environment

```bash
cp server/.env.example server/.env
```

Open `server/.env` and set the required variables:

| Variable | Required | Description | Example / Default |
|----------|----------|-------------|-------------------|
| `DATABASE_URL` | âœ… | SQLite file path (relative to `src/server/`) | `file:./prisma/dev.db` |
| `JWT_SECRET` | âœ… (live) | Strong random secret for JWT | `openssl rand -base64 32` |
| `FRONTEND_URL` | âŒ | Comma-separated CORS origins | `http://localhost:5173` |
| `AI_PROVIDER` | âŒ | `mock` (default) or `watsonx` | `mock` |
| `WATSONX_API_KEY` | âŒ* | IBM Cloud API key | *(see IBM Cloud console)* |
| `WATSONX_PROJECT_ID` | âŒ* | watsonx.ai project ID | *(see watsonx.ai project)* |
| `WATSONX_URL` | âŒ | watsonx.ai endpoint | `https://us-south.ml.cloud.ibm.com` |
| `WATSONX_MODEL_ID` | âŒ | Model to use | `ibm/granite-13b-chat-v2` |
| `PORT` | âŒ | Server port | `5000` |

\* Required only when `AI_PROVIDER=watsonx`.

**Note on JWT_SECRET**: A missing or default secret triggers a warning in development
and causes a fatal error in production (`NODE_ENV=production`). Always set a strong
secret for any live deployment.

### 3. Initialize the Database

```bash
# From bob-ai-hackathon-technix/src/
npm run prisma:generate   # generates the Prisma client
npm run prisma:migrate    # creates src/server/prisma/dev.db and runs migrations
```

### 4. Run the Development Servers

Open two terminals:

```bash
# Terminal 1 â€” Backend (from src/)
npm run dev:server
# â†’ http://localhost:5000

# Terminal 2 â€” Frontend (from src/)
npm run dev:client
# â†’ http://localhost:5173
```

The frontend proxies API requests to the backend. Register an account at
http://localhost:5173/register, then log in and create a patient record.

### 5. Verify Setup

```bash
# Run all server tests
npm test

# Type-check the frontend
npm run typecheck:client

# Production build (client)
npm run build:client
```

---

## Production Build

```bash
# Build both client and server
npm run build   # from src/

# Start the server
cd server && npm start
# â†’ http://0.0.0.0:5000
```

The client build outputs to `src/client/dist/`. Serve it with any static host.

---

## IBM watsonx.ai Setup (Optional)

1. Create an [IBM Cloud account](https://cloud.ibm.com)
2. Create a **watsonx.ai** Studio project and note the **Project ID**
3. Create an **IBM Cloud IAM API Key** (Manage â†’ Access â†’ API Keys)
4. Set in `src/server/.env`:
   ```
   AI_PROVIDER=watsonx
   WATSONX_API_KEY=your-ibm-cloud-api-key
   WATSONX_PROJECT_ID=your-watsonx-project-id
   WATSONX_URL=https://us-south.ml.cloud.ibm.com
   WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
   ```
5. Restart the server â€” watsonx.ai becomes available for `/ask-ai` and `/briefs-ai`.

**Automatic fallback**: If watsonx.ai is unreachable or returns an error, the
system falls back to the deterministic engine. The response will include
`"fallback": true` and the error message. The UI shows an "Deterministic" badge.

---

## Project Structure (after setup)

```
bob-ai-hackathon-technix/src/
â”œâ”€â”€ client/                    # React frontend
â”‚   â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ vite.config.ts
â”œâ”€â”€ server/                    # Express backend
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”œâ”€â”€ utils/
â”‚   â”‚   â””â”€â”€ __tests__/
â”‚   â”œâ”€â”€ prisma/
â”‚   â”‚   â”œâ”€â”€ schema.prisma      # SQLite schema
â”‚   â”‚   â”œâ”€â”€ dev.db             # (gitignored, created by migrate)
â”‚   â”‚   â””â”€â”€ migrations/
â”‚   â””â”€â”€ package.json
â”œâ”€â”€ shared/                    # Shared clinical engine (TypeScript)
â”‚   â””â”€â”€ clinical/
â”œâ”€â”€ scripts/
â”‚   â””â”€â”€ verify-engine.ts
â”œâ”€â”€ package.json               # Workspace-level scripts
â””â”€â”€ .env.example               # Variable reference
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `DATABASE_URL` not working | Ensure path is `file:./prisma/dev.db` (relative to `src/server/`) |
| JWT errors | Set `JWT_SECRET` in `src/server/.env`; do not use the default in production |
| Client can't reach API | Ensure `npm run dev:server` is running on port 5000; check `VITE_API_URL` |
| Prisma generate fails | Run `npm run prisma:generate` from `src/` or `npm run prisma:generate --prefix server` from `src/` |
| Migration fails | Delete `src/server/prisma/dev.db` and re-run `npm run prisma:migrate` |
| watsonx.ai errors | Verify all `WATSONX_*` variables; system falls back to deterministic automatically |
| Demo mode not loading | Ensure URL includes `?demo=1`; check browser console for localStorage errors |
| Test failures | Run `npm install --prefix server` first, then `npm test` from `src/` |