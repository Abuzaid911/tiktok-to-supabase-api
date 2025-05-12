# Deploying TikTok to Supabase API on Vercel

This guide explains how to deploy the TikTok to Supabase API on Vercel.

## Prerequisites

- A [Vercel account](https://vercel.com/signup)
- A [Supabase account](https://supabase.com/) with a project set up
- The Supabase table structure created using the SQL script in `create-supabase-table.sql`

## Steps to Deploy

### 1. Fork or Clone the Repository

First, fork or clone this repository to your GitHub account.

### 2. Connect to Vercel

1. Log in to your Vercel account
2. Click "Add New" > "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `test-crawler` (if your project is in a subdirectory)
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `public`
   - **Install Command**: `npm install`

### 3. Configure Environment Variables

Add the following environment variables in the Vercel project settings:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase API key
- `API_KEY`: A secret key for API authentication
- `DEBUG`: Set to `false`
- `SAVE_LOCAL`: Set to `false` for Vercel deployment
- `SAVE_SUMMARY`: Set to `false` for Vercel deployment
- `HEADLESS`: Set to `true`

### 4. Deploy

Click "Deploy" and wait for the deployment to complete.

## Important Notes for Vercel Deployment

### Serverless Limitations

Vercel uses a serverless architecture, which has some limitations:

1. **Execution Time**: Functions have a maximum execution time of 10 seconds on the hobby plan (up to 60 seconds on paid plans).
2. **Background Processing**: Serverless functions stop executing after sending a response, so background processing won't work as expected.
3. **File System Access**: The file system is read-only except for the `/tmp` directory, and changes don't persist between invocations.

### Workarounds

For production use with Vercel, consider these workarounds:

1. **For Long-Running Tasks**: Use a queue service like AWS SQS, RabbitMQ, or a webhook approach.
2. **For File Storage**: Use Supabase Storage instead of local file storage.
3. **For Background Processing**: Consider using Vercel Cron Jobs or external services like AWS Lambda.

## Testing Your Deployment

After deployment, you can test your API with:

```bash
# Check API status
curl https://your-vercel-url.vercel.app/api/status

# Scrape a TikTok URL
curl -X POST https://your-vercel-url.vercel.app/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"url": "https://www.tiktok.com/@username/video/1234567890"}'
```

## Automated Deployment with GitHub Actions

You can automate deployments to Vercel using GitHub Actions. This project includes a workflow file at `.github/workflows/vercel-deploy.yml` that handles deployment when you push to the main branch.

### Setting up GitHub Secrets

To use the GitHub Actions workflow, you need to add the following secrets to your GitHub repository:

1. **VERCEL_TOKEN**: Your Vercel personal access token
   - Go to your [Vercel account settings](https://vercel.com/account/tokens)
   - Create a new token with an appropriate name and expiration
   - Copy the token and add it as a secret in your GitHub repository

2. **VERCEL_PROJECT_ID**: Your Vercel project ID
   - Run `vercel projects ls` in your terminal after installing the Vercel CLI
   - Find your project in the list and copy its ID
   - Alternatively, go to your project settings in the Vercel dashboard and find the ID in the URL or project details

3. **VERCEL_ORG_ID**: Your Vercel organization ID
   - Run `vercel whoami` to get your organization ID
   - Alternatively, find it in your Vercel dashboard under team settings

Once these secrets are set up, any push to the main branch will automatically trigger a deployment to Vercel.

## Web Interface

A web interface is available at the root URL of your deployment:

```
https://your-vercel-url.vercel.app
``` 