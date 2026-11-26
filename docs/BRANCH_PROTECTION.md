# GitHub Branch Protection & Repository Settings

To enable zero-touch automated merging while preventing broken code from reaching `develop` or `main`, configure the following settings in the GitHub repository UI.

## 1. Repository General Settings

Navigate to **Settings → General → Pull Requests**:

- [x] **Allow squash merging** (recommended default commit message: Pull request title)
- [x] **Allow merge commits** (needed for `branch-sync.yml` syncing `main` -> `develop`)
- [x] **Allow auto-merge** (required for `gh pr merge --auto`)
- [x] **Automatically delete head branches** (keeps `feature/*` and `fix/*` tidy after merge)

## 2. GitHub Actions Permissions

Navigate to **Settings → Actions → General → Workflow permissions**:

- Select **Read and write permissions** (or keep read-only default since workflows declare `pull-requests: write` explicitly).
- [x] Check **Allow GitHub Actions to create and approve pull requests** (required for `automated-pr.yml`, `branch-promotion.yml`, and `branch-sync.yml` to create PRs using `GITHUB_TOKEN`).

## 3. Branch Protection Rules (`main` and `develop`)

Navigate to **Settings → Branches → Add branch protection rule** (or **Rulesets**):

Create identical protection rules for **`main`** and **`develop`**:

- **Branch name pattern**: `main` (and a second rule for `develop`)
- [x] **Require a pull request before merging**
  - Required number of approvals before merging: **0** (automated CI gates replace manual review)
- [x] **Require status checks to pass before merging**
  - [x] **Require branches to be up to date before merging**
  - Add these required status checks (exact job names from `.github/workflows/ci.yml`):
    - `Frontend CI`
    - `Backend CI`
    - `Security & Config Validation`
    - `Integration & Safety Tests`
- [x] **Do not allow bypassing the above settings** (Include administrators)
- [ ] **Allow force pushes**: **Unchecked** (disabled)
- [ ] **Allow deletions**: **Unchecked** (disabled)

## 4. Production Environment Protection

Navigate to **Settings → Environments → `production`**:

- Create an environment named `production`.
- Under **Deployment branches and tags**, select **Selected branches and tags** and add **`main`** only.
- This guarantees no `feature/*`, `fix/*`, or `develop` branch can access production deployment secrets.

## 5. GitHub App Token (Required for Unsuppressed Auto-Merge Triggers)

GitHub suppresses downstream workflow runs (such as `deploy.yml` on `main` or `branch-promotion.yml` on `develop`) when a Pull Request is auto-merged using the default `GITHUB_TOKEN`.

To enable zero-touch `feature/* → develop → main → deploy.yml` automation:

1. Create a **GitHub App** (under your GitHub Account/Org → **Settings → Developer settings → GitHub Apps → New GitHub App**) with minimum repository permissions:
   - **Contents**: Read and write
   - **Pull requests**: Read and write
2. Install the GitHub App on the `attendanceSystem` repository only.
3. Add the App credentials to the repository:
   - **Repository Variable** (`Settings → Secrets and variables → Actions → Variables`): `GH_APP_ID`
   - **Repository Secret** (`Settings → Secrets and variables → Actions → Secrets`): `GH_APP_PRIVATE_KEY` (the generated `.pem` private key)

When configured, `automated-pr.yml`, `branch-promotion.yml`, and `branch-sync.yml` automatically mint short-lived installation tokens via `actions/create-github-app-token@v1` so auto-merges into `develop` and `main` trigger downstream CI and `deploy.yml`.

