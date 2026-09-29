# FactoryWorkforce — Production Cloud Deployment Guide

This guide explains how to deploy **FactoryWorkforce** to the cloud via GitHub, with specific instructions for **Cloudflare Pages**, **Vercel**, and **Docker/Render**.

---

## 1. Push to GitHub

Ensure all your latest changes are pushed to your remote GitHub repository (`main` branch):

```bash
git add -A
git commit -m "chore: configure Cloudflare Workers assets and build scripts"
git push -u origin main
```

---

## 2. Deploying to Cloudflare via CLI or GitHub

### Method A: Deploy via Wrangler CLI

You can deploy directly from your local terminal with one command:

```bash
# This automatically runs `npm run build` then deploys to Cloudflare
npm run deploy
```

Or deploy to Cloudflare Pages directly via CLI:

```bash
npm run pages:deploy
```

---

### Method B: Deploying to Cloudflare Pages via GitHub

Cloudflare Pages automatically builds and deploys your Next.js application on every `git push`.

#### Step 1: Connect GitHub in Cloudflare Dashboard
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left sidebar, navigate to **Compute (Workers & Pages)** > **Create application** > **Pages** tab.
3. Click **Connect to Git**.
4. Select your GitHub account and choose the **`factory-workforce`** repository.
5. Click **Begin setup**.

#### Step 2: Configure Build Settings
Fill in the configuration fields:

| Setting | Value |
| :--- | :--- |
| **Project name** | `factory-workforce` |
| **Production branch** | `main` |
| **Framework preset** | `Next.js` |
| **Build command** | `npm run build` |
| **Build output directory** | `.next/static` |
| **Root directory** | `/` |

### Step 3: Add Environment Variables
Under the **Environment variables (advanced)** section, add:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_Y1IJbMpsm8Do@ep-royal-poetry-b45w7ywy-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require` | Neon Cloud PostgreSQL connection string (pooler) |
| `NODE_VERSION` | `20` | Ensures Node.js 20 LTS build environment |

### Step 4: Deploy
Click **Save and Deploy**. Cloudflare will build the Next.js application, generate Prisma client artifacts, and deploy your site to a permanent `*.pages.dev` domain with automatic global CDN and SSL.

---

## 3. Alternative 1-Click Cloud Deployments

Because FactoryWorkforce is a standard Next.js 14 App Router application with Prisma, you can also deploy it to:

### A. Vercel (Native Next.js Host)
1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the `factory-workforce` GitHub repository.
3. Add `DATABASE_URL` under Environment Variables.
4. Click **Deploy**. Vercel natively handles Next.js App Router, Server Actions, and Neon PostgreSQL with zero configuration.

### B. Docker / Render / Railway
If you want to run the full Node.js + Python environment with container isolation:
- Use the included production `Dockerfile`.
- On Render or Railway, select **Deploy from GitHub repository** -> Docker runtime.
- Add `DATABASE_URL` as an environment variable.

---

## 4. Production Architecture Checklist

- [x] **Database**: Connected to Neon Cloud PostgreSQL via SSL connection pooler.
- [x] **Excel Import Engine**: Automatically runs the Python pipeline when Python 3.12 is present, and gracefully switches to the built-in native TypeScript/JavaScript engine in serverless environments.
- [x] **Excel & PDF Exports**: In-memory binary generation (`exceljs`, `jspdf`) formatted and stream-ready.
- [x] **Statutory 1.5x Overtime**: Authoritative server-side calculation backed by database-driven `PayrollRule`.
- [x] **Audit Ledger**: All sensitive operations (syncs, exports, imports, payroll approvals) logged to `AuditLog`.
