# GitHub Actions Deployment Setup

This guide helps you set up automated deployment using GitHub Actions.

## Step 1: Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following secrets:

### Required Secrets

1. **`CLOUDFLARE_API_TOKEN`**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Click **Create Token**
   - Use **Edit Cloudflare Workers** template
   - Add permissions:
     - `Account.Cloudflare Workers:Edit`
     - `Zone.Cloudflare Pages:Edit`
     - `Account.D1:Edit`
     - `Account.R2:Edit`
     - `Account.KV Storage:Edit`
   - Copy the token and add as secret

2. **`CLOUDFLARE_ACCOUNT_ID`**
   - Found in Cloudflare Dashboard → Right sidebar
   - Copy the Account ID and add as secret

3. **`GITHUB_TOKEN`** (Optional - usually auto-provided)
   - Your GitHub Personal Access Token
   - Permissions needed: `repo` (full control)
   - This is usually provided automatically by GitHub Actions, but you can add it manually if needed

4. **`NEXT_PUBLIC_API_URL`** (Set after first deployment)
   - Your Worker URL (e.g., `https://dragon-station-2026-api.your-subdomain.workers.dev`)
   - Set this after deploying the worker for the first time

## Step 2: Verify Secrets

After adding secrets, verify they're set:
- Go to **Settings** → **Secrets and variables** → **Actions**
- You should see all the secrets listed

## Step 3: Trigger Deployment

### Automatic Deployment
- Push to `main` or `master` branch
- GitHub Actions will automatically deploy

### Manual Deployment
- Go to **Actions** tab in your repository
- Select **Deploy to Cloudflare** workflow
- Click **Run workflow** → **Run workflow**

## Step 4: Monitor Deployment

1. Go to **Actions** tab
2. Click on the running workflow
3. Watch the deployment progress
4. Check for any errors in the logs

## Troubleshooting

### "Authentication failed" error
- Verify `CLOUDFLARE_API_TOKEN` is correct
- Check token has required permissions
- Ensure token hasn't expired

### "Account ID not found" error
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct
- Check it matches your Cloudflare account

### Build failures
- Check build logs in Actions tab
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Ensure all dependencies are in `package.json`

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit secrets to git
- Never share your tokens publicly
- Rotate tokens regularly
- Use least-privilege permissions
- If a token is exposed, revoke it immediately in Cloudflare/GitHub settings

## Next Steps

After successful deployment:
1. Set up Cloudflare resources (D1, R2, KV, Queue)
2. Configure worker secrets via `wrangler secret put`
3. Run database migrations: `npm run db:migrate:prod`
4. Deploy frontend apps (if not done automatically)

