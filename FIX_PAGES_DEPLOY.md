# 🚨 Quick Fix: Cloudflare Pages Deployment Error

## The Problem

Your build succeeds ✅ but deployment fails with:
```
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```

**Root Cause**: Cloudflare Pages has a "Deploy command" set to `npx wrangler deploy`, which is **only for Workers, not Pages**.

## ✅ Solution (2 minutes)

### Step 1: Open Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click on your Pages project (the one that's failing)

### Step 2: Remove the Deploy Command

1. Click **Settings** → **Builds & deployments**
2. Scroll to **Build configuration**
3. Find the **"Deploy command"** field
4. **Delete everything** in that field (make it completely empty)
5. Click **Save**

### Step 3: Verify Your Settings

**Your Pages project should have:**

- ✅ **Build command**: `npm run build` (or `cd apps/store && npm ci && npm run build`)
- ✅ **Build output directory**: `apps/store/.next` (or `apps/admin/.next`)
- ✅ **Root directory**: `/` (or empty)
- ✅ **Deploy command**: **(EMPTY)** ← This is critical!

### Step 4: Redeploy

After saving, Cloudflare Pages will automatically trigger a new deployment. The build will succeed and Pages will automatically deploy the `.next` output.

## Why This Happens

- **Cloudflare Pages** = Automatically deploys your build output (`.next` folder) - **NO deploy command needed**
- **Cloudflare Workers** = Need `wrangler deploy` command to deploy code
- These are **different services** - don't mix them!

## Your Build is Working! ✅

Your build logs show:
- ✅ Admin panel builds successfully
- ✅ Storefront builds successfully
- ✅ All pages generated correctly

You just need to remove the deploy command and Pages will automatically deploy.

## Alternative: Use GitHub Actions

If you prefer automated deployments, use the GitHub Actions workflow (`.github/workflows/deploy.yml`) which:
- ✅ Builds both Next.js apps
- ✅ Deploys API Worker separately
- ✅ Deploys Pages correctly
- ✅ No dashboard configuration needed

See `FIX_DEPLOYMENT.md` for GitHub Actions setup.

