# AttendEase Production Rollback Guide

If a production deployment fails post-deploy health checks or introduces a regression, follow the appropriate rollback procedure below.

## 1. Fast Hosting Rollback (No Git Changes Required)

### Frontend (Netlify)
1. Open **Netlify Dashboard → Deploys**.
2. Locate the last known healthy deployment.
3. Click **Publish deploy** to immediately restore the previous static bundle.

### Backend (Render)
1. Open **Render Dashboard → Events / Deploys**.
2. Locate the last known healthy deployment.
3. Click **Rollback to this deploy** (or **Redeploy** on the previous commit).

## 2. Git-Based Rollback (Recommended for Permanent Fix)

Never force-push to `main`. Instead, create a revert commit via Pull Request:

```bash
git checkout main
git pull origin main
git checkout -b fix/revert-bad-release
git revert <bad-commit-sha> --no-edit
git push -u origin fix/revert-bad-release
```

- `automated-pr.yml` and `ci.yml` will validate the revert.
- Merge into `develop` (or open a `hotfix/*` PR to `main` for urgent fixes).
- Once merged to `main`, `deploy.yml` will automatically redeploy both Render and Netlify and verify `/api/health`.

## 3. Database Safety

- AttendEase CI/CD does **not** execute destructive database migrations.
- If a schema or data issue occurs in MongoDB Atlas, restore from your **MongoDB Atlas Continuous Backup / Cloud Snapshot** via the Atlas Console before redeploying the previous backend version.
