# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automating the RepoTrend project.

## Workflow Overview

The project uses four interconnected workflows to fetch repository data, curate selections, deploy the site, and post to Bluesky:

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   fetch-repos.yml   │───▶│ pick-random-repos.yml │───▶│   deploy-site.yml   │───▶│  post-to-bsky.yml   │
│   (Fetches data)    │    │   (Curates repos)      │    │   (Deploys site)    │    │   (Posts to Bluesky)  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

---

## Workflows

### 1. `fetch-repos.yml` - Fetch Repository Data

Fetches trending repository data from GitHub API with various time ranges and star thresholds.

**Triggers:**
- Schedule: 4 times daily (00:00, 06:00, 12:00, 18:00 UTC)
- Manual: `workflow_dispatch`

**What it does:**
- Runs 5 separate Node.js scripts to fetch repositories:
  | Script | Time Range | Star Threshold |
  |--------|------------|----------------|
  | `fetch-repos-alltime-50000stars.js` | All time | 50,000+ stars |
  | `fetch-repos-2years-10000stars.js` | 2 years | 10,000+ stars |
  | `fetch-repos-90days-1000stars.js` | 90 days | 1,000+ stars |
  | `fetch-repos-30days-100-999stars.js` | 30 days | 100-999 stars |
  | `fetch-repos-3days-50-99stars.js` | 3 days | 50-99 stars |
- Saves data to `data/` directory
- Commits and pushes changes automatically

---

### 2. `pick-random-repos.yml` - Curate Random Repositories

Selects random repositories from the fetched data for display on the site.

**Triggers:**
- Schedule: Every 8 hours (00:00, 08:00, 16:00 UTC)
- Manual: `workflow_dispatch`

**What it does:**
- Runs `pick-random-repos.js` to select repositories
- Updates `site/repos.json` with curated selection
- Commits and pushes changes automatically

---

### 3. `deploy-site.yml` - Deploy to FTP

Deploys the static site to production FTP servers.

**Triggers:**
- Schedule: 3 times daily (04:00, 12:00, 20:00 UTC)
- Manual: `workflow_dispatch`

**What it does:**
- Uploads `site/` directory to two FTP locations:
  - `repotrend.com` → `/public_html/repotrend.com/`
  - `te9.dev/repotrend` → `/public_html/te9.dev/repotrend/`

**Required Secrets:**
- `FTP_SERVER` - FTP server hostname
- `FTP_USERNAME` - FTP username
- `FTP_PASSWORD` - FTP password

---

### 4. `post-to-bsky.yml` - Post to Bluesky

Posts a random repository to Bluesky after each site deployment.

**Triggers:**
- After `deploy-site.yml` completes successfully
- Manual: `workflow_dispatch`

**What it does:**
- Reads available repos from `site/repos.json`
- Checks `bsky/posted-repos.json` to avoid duplicates
- Picks a random unposted repo
- Posts repo details to Bluesky (te9-dev.bsky.social)
- Updates `bsky/posted-repos.json` with the posted repo

**Required Secrets:**
- `BSKY_HANDLE` - Bluesky handle (e.g., te9-dev.bsky.social)
- `BSKY_PASSWORD` - Bluesky app password

---

## Schedule Summary

| Workflow | UTC Times | Frequency |
|----------|-----------|-----------|
| fetch-repos.yml | 0, 6, 12, 18 | Every 6 hours |
| pick-random-repos.yml | 0, 8, 16 | Every 8 hours |
| deploy-site.yml | 4, 12, 20 | 3 times daily |
| post-to-bsky.yml | After deploy | On deployment |

---

## Manual Triggers

All workflows support manual triggering via the GitHub Actions UI:
1. Go to **Actions** tab in GitHub
2. Select the workflow from the left sidebar
3. Click **Run workflow**

---

## Data Flow

1. **fetch-repos.yml** collects raw repository data from GitHub → `data/`
2. **pick-random-repos.yml** processes and curates repos → `site/repos.json`
3. **deploy-site.yml** uploads the final site → production servers
4. **post-to-bsky.yml** posts a new repo to Bluesky → `bsky/posted-repos.json`