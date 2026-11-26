# AttendEase CI/CD Pipeline Architecture

This document describes the automated GitHub Actions CI/CD pipeline for **AttendEase**.

## Pipeline Overview

| Workflow File | Trigger | Purpose |
| :--- | :--- | :--- |
| `.github/workflows/ci.yml` | `push` (`develop`, `feature/**`, `fix/**`, `hotfix/**`), `pull_request` (`develop`, `main`) | Frontend/Backend builds, unit tests, security checks, and isolated MongoDB integration/safety tests |
| `.github/workflows/automated-pr.yml` | `push` (`feature/**`, `fix/**`) | Creates/updates a PR targeting `develop` and enables squash auto-merge |
| `.github/workflows/branch-promotion.yml` | `push` (`develop`) | Checks merge compatibility with `main`, creates/updates a PR targeting `main`, and enables squash auto-merge |
| `.github/workflows/branch-sync.yml` | `push` (`main`) | Creates/updates a sync PR from `main` back into `develop` when `develop` falls behind |
| `.github/workflows/deploy.yml` | `push` (`main`), `workflow_dispatch` | Triggers Render backend & Netlify frontend deploy hooks and verifies `/api/health` and frontend availability |

## CI Jobs (`ci.yml`)

1. **Frontend CI (`frontend`)**
   - Installs dependencies using `npm --prefix frontend ci`.
   - Runs ESLint if configured in `frontend/`.
   - Validates TypeScript (`npx --prefix frontend tsc -b --noEmit`).
   - Runs frontend unit tests (`npm run test:frontend`).
   - Builds the production bundle (`npm --prefix frontend run build`).

2. **Backend CI (`backend`)**
   - Installs dependencies using `npm --prefix backend ci`.
   - Runs ESLint if configured in `backend/`.
   - Validates TypeScript (`npx --prefix backend tsc --noEmit`).
   - Builds `dist/` (`npm --prefix backend run build`).

3. **Security & Config Validation (`security`)**
   - Audits production dependencies (`npm audit --omit=dev --audit-level=high`).
   - Verifies no `.env` or `atlas-credentials.env` files are tracked in Git.
   - Scans tracked files for hardcoded secrets (`mongodb+srv://`, tokens, private keys).
   - Verifies `backend/.env.example` and `frontend/.env.example` are present and valid.

4. **Integration & Safety Tests (`integration`)**
   - Runs after `frontend`, `backend`, and `security` pass.
   - Uses an ephemeral `mongo:7` service container (`mongodb://127.0.0.1:27017/attendease_ci_test`)—**never** connects to MongoDB Atlas production.
   - Runs:
     - `npm --prefix backend run test:chat` (Chat, connections, tenant isolation)
     - `npm --prefix backend run test:realtime` (Socket.IO real-time messaging & presence)
     - `npm --prefix backend run test:date-separators` (Timezone-aware chat date separators)
     - `npm --prefix backend run test:safety` (JWT auth, RBAC, tenant isolation, attendance checkout/session, holidays, deactivated accounts)
     - `npm --prefix backend run seed` + `npm run test:e2e` against an ephemeral local server on port `5050`.

## Running Checks Locally

```bash
# Builds
npm run build:frontend
npm run build:backend

# Frontend unit tests
npm run test:frontend

# Backend integration & safety tests (requires local MongoDB running)
npm run test:chat
npm run test:realtime
npm run test:date-separators
npm run test:safety
```
