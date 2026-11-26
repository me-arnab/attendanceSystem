# AttendEase Automated Git Workflow

## Branch Architecture

| Branch | Purpose | Protection |
| :--- | :--- | :--- |
| `main` | Production | Protected; deploys to Render + Netlify via `deploy.yml` |
| `develop` | Integration & staging | Protected; receives `feature/*` and `fix/*` PRs |
| `feature/*` | New features | Auto-creates PR to `develop` with squash auto-merge |
| `fix/*` | Bug fixes | Auto-creates PR to `develop` with squash auto-merge |
| `hotfix/*` | Urgent production fixes | Auto-creates PR to `main` with squash auto-merge; `branch-sync.yml` syncs `main` back to `develop` |

## Day-to-Day Developer Flow

1. **Create a branch from `develop`**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```
2. **Commit and push**:
   ```bash
   git push -u origin feature/my-feature
   ```
3. **Automated CI & PR (`automated-pr.yml`)**:
   - GitHub Actions runs `ci.yml` on `feature/my-feature`.
   - `automated-pr.yml` automatically opens (or updates) a Pull Request to `develop` and enables **squash auto-merge**.
   - Once all required checks (`Frontend CI`, `Backend CI`, `Security & Config Validation`, `Integration & Safety Tests`) pass, GitHub automatically squash-merges the PR into `develop`.
4. **Automated Promotion (`branch-promotion.yml`)**:
   - When `develop` is updated, `ci.yml` runs again on `develop`.
   - `branch-promotion.yml` verifies clean merge compatibility with `main` (failing if conflicts exist—never force-merging), opens/updates a PR from `develop` to `main`, and enables **squash auto-merge**.
   - Once all required checks pass, GitHub automatically squash-merges `develop` into `main`.
5. **Production Deployment (`deploy.yml`)**:
   - Merging into `main` triggers `deploy.yml`, which deploys the backend to Render and frontend to Netlify, then verifies `/api/health` and the frontend URL.
6. **Branch Sync (`branch-sync.yml`)**:
   - After `main` updates (e.g., from a `hotfix/*` PR or squash-merge), `branch-sync.yml` opens a non-destructive sync PR from `main` to `develop` if `develop` is behind.

## Conflict Handling

- Conflicts are **never** force-resolved by automation.
- If `branch-promotion.yml` or `branch-sync.yml` detects a merge conflict, the workflow fails and requires a developer to resolve the conflict locally and push.
