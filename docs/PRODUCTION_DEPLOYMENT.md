# AttendEase Production Deployment Guide (Netlify + Render + MongoDB Atlas)

Production deployments are triggered **exclusively** by `.github/workflows/deploy.yml` after code is merged into `main` and passes pre-deploy validation.

## 1. Required GitHub Secrets

Add these secrets under **Settings → Environments → `production` → Environment secrets** (or Repository secrets):

| Secret Name | Description | Where to Get It |
| :--- | :--- | :--- |
| `BACKEND_DEPLOY_HOOK_URL` | Render Deploy Hook URL for the backend service | Render Dashboard → Backend Service → **Settings** → **Deploy Hook** |
| `FRONTEND_DEPLOY_HOOK_URL` | Netlify Build Hook URL for the frontend site | Netlify Dashboard → Site Configuration → **Build & deploy** → **Build hooks** → **Add build hook** (branch: `main`) |
| `BACKEND_HEALTH_URL` | Public backend health endpoint URL | `https://<your-render-service>.onrender.com/api/health` |
| `FRONTEND_URL` | Public Netlify frontend URL | `https://<your-site>.netlify.app` (or custom domain) |

## 2. Render (Backend) Configuration

In your Render Web Service dashboard:

1. **Disable Independent Auto-Deploys**:
   - Go to **Settings → Build & Deploy → Auto-Deploy**.
   - Set **Auto-Deploy** to **No**.
   - **Why**: Prevents Render from deploying directly on Git pushes to `main` before GitHub Actions `deploy.yml` runs pre-deploy checks.
2. **Branch**: Set to `main`.
3. **Root Directory**: `backend`
4. **Build Command**: `npm ci && npm run build`
5. **Start Command**: `npm start`
6. **Health Check Path**: `/api/health`
7. **Environment Variables on Render**:
   - `NODE_ENV=production`
   - `MONGODB_URI=<MongoDB Atlas production connection string>`
   - `JWT_SECRET=<Strong random 32+ char production secret — never the dev default>`
   - `JWT_EXPIRES_IN=7d`
   - `FRONTEND_URL=<Your Netlify production URL>`

## 3. Netlify (Frontend) Configuration

In your Netlify Site dashboard:

1. **Disable Independent Auto-Publishing / Git Auto-Builds**:
   - Go to **Site configuration → Build & deploy → Continuous deployment → Build settings**.
   - Click **Configure** → **Stop builds** (or set **Builds** to **Stopped / Inactive**), OR keep branch deploys disabled and trigger builds **only** via the Netlify **Build Hook** (`FRONTEND_DEPLOY_HOOK_URL`).
   - **Why**: Prevents Netlify from building and publishing `main` independently of GitHub Actions validation.
2. **Base directory**: `frontend`
3. **Build command**: `npm ci && npm run build`
4. **Publish directory**: `frontend/dist`
5. **Environment Variables on Netlify**:
   - `VITE_API_URL=<Your Render backend URL>/api` (if used by your frontend API client)
   - `VITE_ENABLE_DEMO_LOGINS=false`
6. **SPA Routing (`_redirects` / `netlify.toml`)**:
   - Ensure Netlify routes all SPA paths to `/index.html` (`/* /index.html 200`) if using client-side React Router paths directly.

## 4. MongoDB Atlas Isolation

- **Production**: Only the Render backend service holds the production `MONGODB_URI` for MongoDB Atlas.
- **CI/CD**: GitHub Actions `ci.yml` never receives Atlas credentials. It runs all integration and safety tests against an ephemeral `mongo:7` Docker container (`mongodb://127.0.0.1:27017/attendease_ci_test`).
- **Migrations**: No destructive database migrations are automated in CI or CD.

## 5. Post-Deployment Verification

After triggering both hooks, `deploy.yml` automatically:
1. Polls `BACKEND_HEALTH_URL` until HTTP `200` with `{"status":"OK", ...}`.
2. Polls `FRONTEND_URL` until HTTP `200`.
3. Records the deployed commit SHA, branch, actor, and timestamp in the GitHub Actions job summary.
