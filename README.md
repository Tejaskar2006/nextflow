# NextFlow

> Production-ready visual LLM workflow builder — a Krea.ai-inspired SaaS built with Next.js 14, React Flow, Trigger.dev, and Gemini.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (TypeScript strict) |
| Canvas | React Flow (`@xyflow/react`) |
| State | Zustand + Immer |
| Auth | Clerk |
| Database | Prisma + Neon PostgreSQL |
| Async Tasks | Trigger.dev v3 |
| File Uploads | Transloadit + Uppy |
| LLM | Google Gemini (`@google/generative-ai`) |
| FFmpeg | fluent-ffmpeg (via Trigger.dev) |
| Styling | Vanilla CSS with design tokens |

## Node Types

| Node | Input | Output | Async |
|---|---|---|---|
| Text | — | `text` | No |
| Upload Image | — | `image` | No (client-side) |
| Upload Video | — | `video` | No (client-side) |
| LLM (Gemini) | `text`, `image[]` | `text` | Yes (Trigger.dev) |
| Crop Image | `image` | `image` | Yes (FFmpeg) |
| Extract Frame | `video` | `image` | Yes (FFmpeg) |

## Setup

### 1. Clone + Install

```bash
cd nextflow
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Fill in all values (Neon, Clerk, Trigger.dev, Transloadit, Google AI)
```

### 3. Database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run (two terminals)

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Trigger.dev worker
npx trigger.dev@latest dev
```

### 5. Seed Sample Workflow (optional)

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

## Deployment

### Vercel (Next.js)

```bash
vercel --prod
```

Add all environment variables from `.env.example` to Vercel project settings.

### Trigger.dev (Worker)

```bash
npx trigger.dev@latest deploy
```

### Database Migration (Production)

```bash
DATABASE_URL="your_neon_url" npx prisma migrate deploy
```

## Architecture

```
Left Sidebar          Canvas (React Flow)         Right Sidebar
────────────          ──────────────────         ─────────────
Node Library    →   DAG Builder + Editor   →   Run History
6 node types        Type-safe connections       Node breakdown
Drag to canvas      Undo/redo (50 deep)         Inputs/outputs
                    Auto-save (1.5s)            Error details
                    Parallel execution
```

## DAG Execution

- Kahn's topological sort detects cycles at connection time
- Independent branches execute in `Promise.allSettled` (parallel)
- Failed upstream nodes mark downstream as SKIPPED
- All async nodes dispatch to Trigger.dev (never blocks the API)
- WorkflowRun + NodeRun records persisted in PostgreSQL

## Sample Workflow

**Product Marketing Kit Generator** (`prisma/seed.ts`):
- Branch A: Text → LLM (copy generation)
- Branch B: Image → Crop → LLM (visual analysis)
- Branch C: Video → ExtractFrame → LLM (frame analysis)
- All branches converge to a final Text node
