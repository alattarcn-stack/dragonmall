# ⚠️ Cloudflare Pages Deployment Fix

## Problem

Your build is **successful** ✅, but deployment fails with:
```
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```

This happens because Cloudflare Pages is trying to run `npx wrangler deploy`, which is **only for Workers, not Pages**.

## Solution (2 minutes)

### Step 1: Go to Cloudflare Dashboard

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **Workers & Pages**
3. Click on your Pages project (store or admin)

### Step 2: Remove Deploy Command

1. Click **Settings** → **Builds & deployments**
2. Scroll to **Build configuration**
3. Find the **"Deploy command"** field
4. **Delete everything** in that field (leave it completely empty)
5. Click **Save**

### Step 3: Verify Settings

Your build settings should look like this:

**For Storefront:**
- **Build command**: `cd apps/store && npm ci && npm run build`
- **Build output directory**: `apps/store/.next`
- **Root directory**: `/` (or empty)
- **Deploy command**: (empty - this is correct!)

**For Admin Panel:**
- **Build command**: `cd apps/admin && npm ci && npm run build`
- **Build output directory**: `apps/admin/.next`
- **Root directory**: `/` (or empty)
- **Deploy command**: (empty - this is correct!)

### Step 4: Redeploy

After saving, Cloudflare Pages will automatically trigger a new deployment. The build will succeed and Pages will automatically deploy the `.next` output - no deploy command needed!

## Why This Happens

- **Cloudflare Pages** automatically deploys your build output (the `.next` folder)
- **Cloudflare Workers** need `wrangler deploy` to deploy code
- These are **two different services** - don't mix them!

## Your Build is Working! ✅

Your build logs show:
- ✅ Admin panel builds successfully
- ✅ Storefront builds successfully
- ✅ All pages generated correctly

You just need to remove the deploy command and Pages will automatically deploy your built app.

## Still Having Issues?

If you're still seeing the error after removing the deploy command:

1. Check that you saved the settings
2. Wait for the automatic redeploy to complete
3. Check the deployment logs - the build should succeed and deployment should happen automatically

---

**Note**: The API Worker is deployed separately using `wrangler deploy --config infra/wrangler.toml` (via GitHub Actions or manually). Pages projects don't need this command.

