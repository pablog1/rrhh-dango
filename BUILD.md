# Build Instructions

## Local Development

```bash
npm run dev
```

## Production Build

### Important: NODE_ENV Configuration

**DO NOT** set `NODE_ENV` manually when building for production. Next.js sets this automatically.

If you have `NODE_ENV` set in your environment (e.g., in `.bashrc`, `.zshrc`, or Docker), you may encounter this error:

```
Error: <Html> should not be imported outside of pages/_document.
```

### Solution

**Option 1: Unset NODE_ENV before building**
```bash
unset NODE_ENV && npm run build
```

**Option 2: Use env command**
```bash
env -u NODE_ENV npm run build
```

**Option 3: Remove from shell config**
Remove any `export NODE_ENV=development` lines from your shell configuration files.

### Railway/Vercel Deployment

For Railway or Vercel deployments:

1. **DO NOT** add `NODE_ENV` to your environment variables in the platform settings
2. Railway and Vercel automatically set `NODE_ENV=production` during builds
3. If you previously set `NODE_ENV` in Railway:
   - Go to your project settings
   - Navigate to Variables tab
   - Delete any `NODE_ENV` variable
   - Trigger a new deployment

**Note:** The downgrade from Next.js 15.5.6 to 15.1.6 was necessary to avoid known build issues with error page generation in newer versions.

## Build Verification

After building, you can test the production build locally:

```bash
npm run start
```

This will serve the built application on `http://localhost:3000`.
