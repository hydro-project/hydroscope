# GitHub Actions CI/CD

This repository uses GitHub Actions for continuous integration and deployment.

## Workflows

### 🔄 CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`

**What it does:**
- Tests on Node.js 18 and 20
- Type checks (both standard and strict)
- Lints code with ESLint
- Checks code formatting with Prettier
- Runs the full test suite
- Builds the package
- Uploads build artifacts

### 🚀 Release Workflow (`.github/workflows/release.yml`)

**Triggers:**
- When a GitHub release is published

**What it does:**
- Runs the full CI pipeline
- Publishes to NPM (requires `NPM_TOKEN` secret)

## Setup Instructions

### 1. Enable GitHub Actions
GitHub Actions are automatically enabled for new repositories. If you need to enable them manually:
1. Go to your repository on GitHub
2. Click the "Actions" tab
3. Click "I understand my workflows, go ahead and enable them"

### 2. Set up NPM Publishing (Optional)
To enable automatic NPM publishing on releases:

1. Go to [npmjs.com](https://www.npmjs.com) and create an access token:
   - Go to your account settings
   - Click "Access Tokens"
   - Click "Generate New Token"
   - Choose "Automation" type
   - Copy the token

2. Add the token to GitHub secrets:
   - Go to your repository on GitHub
   - Click "Settings" → "Secrets and variables" → "Actions"
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your NPM token
   - Click "Add secret"

### 3. Branch Protection (Recommended)
Set up branch protection rules to require CI to pass:

1. Go to repository "Settings" → "Branches"
2. Click "Add rule"
3. Branch name pattern: `main`
4. Check "Require status checks to pass before merging"
5. Search for and select the CI check
6. Check "Require branches to be up to date before merging"
7. Click "Create"

## Local Development

Run the same checks locally before pushing:

```bash
# Run all CI checks
npm run typecheck && npm run typecheck:strict && npm run lint && npm run format:check && npm test && npm run build

# Or run them individually
npm run typecheck      # Type checking
npm run lint           # Code linting
npm run format:check   # Code formatting check
npm test              # Run tests
npm run build         # Build package
```

## Monitoring

- Check the "Actions" tab in your GitHub repository to see workflow runs
- Failed workflows will send notifications to repository watchers
- Pull requests will show CI status inline

## Dependabot

Dependabot is configured to:
- Check for npm dependency updates weekly
- Check for GitHub Actions updates weekly
- Create PRs with dependency updates
- Limit to 10 npm PRs and 5 GitHub Actions PRs at a time
