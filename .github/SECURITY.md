# Security Guidelines

## Token Management

### GitHub Personal Access Tokens

**NEVER commit tokens to git!**

If you accidentally commit a token:
1. **Immediately revoke it** at https://github.com/settings/tokens
2. Remove it from git history using `git filter-branch` or BFG Repo-Cleaner
3. Generate a new token
4. Add it as a GitHub Secret (not in code)

### Cloudflare API Tokens

- Store in GitHub Secrets (for CI/CD)
- Store in `.dev.vars` for local development (already in `.gitignore`)
- Use `wrangler secret put` for production

### Environment Variables

- ✅ **Safe**: `.dev.vars` (in `.gitignore`)
- ✅ **Safe**: GitHub Secrets
- ✅ **Safe**: Cloudflare Workers secrets
- ❌ **Never**: Hardcode in source files
- ❌ **Never**: Commit to git
- ❌ **Never**: Share in public channels

## Best Practices

1. Use least-privilege permissions
2. Rotate tokens regularly (every 90 days)
3. Monitor token usage
4. Use separate tokens for dev/prod
5. Revoke unused tokens immediately

