# Cloudflare Pages Deployment Configuration

## Issue

If Cloudflare Pages is trying to run `npx wrangler deploy` as a deploy command, this is incorrect. Pages should automatically deploy the built Next.js app without a deploy command.

## Solution

### For Storefront (`apps/store`)

1. Go to Cloudflare Dashboard → **Workers & Pages** → Your Pages project
2. Go to **Settings** → **Builds & deployments**
3. **Remove or leave empty** the "Deploy command" field
4. Ensure these settings:
   - **Build command**: `cd apps/store && npm ci && npm run build`
   - **Build output directory**: `apps/store/.next`
   - **Root directory**: `/` (or leave empty)
   - **Deploy command**: (leave empty or remove)

### For Admin Panel (`apps/admin`)

1. Go to Cloudflare Dashboard → **Workers & Pages** → Your Pages project
2. Go to **Settings** → **Builds & deployments**
3. **Remove or leave empty** the "Deploy command" field
4. Ensure these settings:
   - **Build command**: `cd apps/admin && npm ci && npm run build`
   - **Build output directory**: `apps/admin/.next`
   - **Root directory**: `/` (or leave empty)
   - **Deploy command**: (leave empty or remove)

## Important Notes

- **Pages automatically deploys** the build output - no deploy command needed
- The `npx wrangler deploy` command is only for **Workers**, not Pages
- Workers are deployed separately via GitHub Actions or manually using `wrangler deploy --config infra/wrangler.toml`

## Alternative: Use GitHub Actions

Instead of using Cloudflare Pages' automatic deployment, you can use the GitHub Actions workflow (`.github/workflows/deploy.yml`) which properly handles:
- Building the Next.js apps
- Deploying to Cloudflare Pages
- Deploying the API Worker separately

This is the recommended approach as it gives you more control and proper separation of concerns.

