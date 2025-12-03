# 🔧 Fix Cloudflare Pages Deployment - Quick Guide

## The Problem

Your build succeeds ✅ but deployment fails because Cloudflare Pages is trying to run `npx wrangler deploy` (which is for Workers, not Pages).

## ✅ Solution 1: Use GitHub Actions (Recommended - No Dashboard Changes Needed)

Your repository already has a properly configured GitHub Actions workflow that will deploy everything correctly!

### Setup (One-time):

1. **Go to GitHub** → Your repository → **Settings** → **Secrets and variables** → **Actions**
2. **Add these secrets:**
   - `CLOUDFLARE_API_TOKEN` - Get from [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
     - Create token with permissions: `Account.Cloudflare Workers:Edit` and `Zone.Cloudflare Pages:Edit`
   - `CLOUDFLARE_ACCOUNT_ID` - Found in Cloudflare Dashboard → Right sidebar
   - `NEXT_PUBLIC_API_URL` - Your Worker URL (set after first deployment)

3. **Disable Cloudflare Pages auto-deploy** (optional but recommended):
   - Go to Cloudflare Dashboard → **Workers & Pages** → Your Pages project
   - **Settings** → **Builds & deployments**
   - Disable "Automatic deployments from Git" (or leave it - GitHub Actions will handle it)

4. **Push to main branch** - GitHub Actions will automatically:
   - ✅ Build both Next.js apps
   - ✅ Deploy API Worker
   - ✅ Deploy Storefront to Pages
   - ✅ Deploy Admin Panel to Pages

**That's it!** No need to fix the deploy command in the dashboard.

---

## ✅ Solution 2: Fix in Cloudflare Dashboard (Manual Fix)

If you prefer to use Cloudflare Pages' built-in deployment:

### For Storefront:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Click on your **storefront Pages project**
3. Go to **Settings** → **Builds & deployments**
4. Scroll to **Build configuration**
5. Find **"Deploy command"** field
6. **Delete everything** in that field (make it completely empty)
7. Click **Save**

### For Admin Panel:

Repeat the same steps for your admin panel Pages project.

### Verify Settings:

**Storefront should have:**
- Build command: `cd apps/store && npm ci && npm run build`
- Build output directory: `apps/store/.next`
- Root directory: `/` (or empty)
- **Deploy command: (EMPTY)** ← This is the key!

**Admin Panel should have:**
- Build command: `cd apps/admin && npm ci && npm run build`
- Build output directory: `apps/admin/.next`
- Root directory: `/` (or empty)
- **Deploy command: (EMPTY)** ← This is the key!

---

## Why This Happens

- **Cloudflare Pages** = Automatically deploys your build output (`.next` folder)
- **Cloudflare Workers** = Need `wrangler deploy` command
- These are **different services** - don't mix them!

## Your Build is Working! ✅

Your build logs show everything is building correctly:
- ✅ Admin panel builds successfully
- ✅ Storefront builds successfully  
- ✅ All pages generated correctly

You just need to remove the deploy command and Pages will automatically deploy.

---

## Recommendation

**Use Solution 1 (GitHub Actions)** because:
- ✅ Already configured correctly
- ✅ No dashboard changes needed
- ✅ More control and visibility
- ✅ Proper separation: Worker vs Pages deployments
- ✅ Automatic on every push to main

The workflow file (`.github/workflows/deploy.yml`) is already set up correctly!

