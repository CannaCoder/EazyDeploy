# GitHub App Setup — Shipora

This guide walks you through creating and configuring the GitHub App required for Shipora.

---

## Why a GitHub App?

Shipora needs a GitHub App (not a personal access token) because:
- It can be installed on any GitHub organization or user account
- It has fine-grained permissions (only what it needs)
- It posts commit status checks (`shipora/conflict-guard`)
- It receives push and PR webhooks
- It fetches repository file trees and contents for analysis

---

## Step 1: Create the GitHub App

1. Go to **GitHub → Settings → Developer Settings → GitHub Apps → New GitHub App**
2. Fill in the following:

| Field | Value |
|---|---|
| **GitHub App Name** | `Shipora` (or `Shipora Dev` for local) |
| **Homepage URL** | `https://shipora.dev` (or `http://localhost:3000`) |
| **Webhook URL** | `https://your-api.shipora.dev/webhooks/github` (or use smee.io for local dev) |
| **Webhook Secret** | Generate a strong random string — save it as `GITHUB_APP_WEBHOOK_SECRET` |

---

## Step 2: Set Permissions

### Repository Permissions
| Permission | Access |
|---|---|
| **Contents** | Read |
| **Commit statuses** | Read & Write |
| **Metadata** | Read |
| **Pull requests** | Read |
| **Webhooks** | Read & Write |

### Subscribe to Events
- [x] Push
- [x] Pull request
- [x] Check run

---

## Step 3: Save Credentials

After creating the app:

1. Note the **App ID** → `GITHUB_APP_ID`
2. Generate a **Private Key** (download the `.pem` file) → `GITHUB_APP_PRIVATE_KEY`
   - Store the key contents as a single-line string with `\n` for newlines in your `.env`
3. Note the **Client ID** and generate a **Client Secret** → `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

---

## Step 4: Install the App

1. Go to your GitHub App's page → **Install App**
2. Install it on the repositories you want to deploy with Shipora
3. The `installation_id` will be included in webhook payloads automatically

---

## Step 5: Local Development (Webhook Proxy)

For local development, use [smee.io](https://smee.io) to forward GitHub webhooks to your local machine:

```bash
# Install smee client
npm install -g smee-client

# Start forwarding (replace with your smee channel URL)
smee -u https://smee.io/your-channel-id -t http://localhost:3001/webhooks/github
```

Set your GitHub App's Webhook URL to your smee channel URL.

---

## Verifying the Setup

Once configured, push a commit to a repository with Shipora installed. You should see:
- A `shipora/conflict-guard` status check appear on the commit in GitHub
- A webhook event logged in Shipora's dashboard audit log
