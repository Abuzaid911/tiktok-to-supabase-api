# TikTok to Supabase API

A RESTful API that allows you to scrape TikTok videos and store the data in Supabase with simple HTTP requests.

## Features

- Simple REST API for scraping TikTok videos
- Process single or multiple URLs in the background
- Secure API key authentication
- Web interface for easy testing
- Asynchronous processing to handle large batches
- Serverless deployment support (Vercel)

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Supabase account and project

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables by creating a `.env` file:
   ```
   # Supabase configuration
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-supabase-api-key

   # API configuration
   PORT=3000
   API_KEY=your-secret-api-key

   # TikTok scraper configuration
   DEBUG=false
   SAVE_LOCAL=true
   SAVE_SUMMARY=true
   HEADLESS=true
   USE_SUPABASE_STORAGE=false
   SAVE_SCREENSHOTS=false
   ```

3. Make sure your Supabase table is set up:
   - Run the SQL script in the Supabase SQL editor to create the `tiktok_videos` table

4. Set up Supabase storage:
   ```bash
   npm run setup-storage
   ```

### Starting the API

```bash
npm run api
```

The API will be available at `http://localhost:3000` (or the port specified in your `.env` file).

## API Endpoints

### Check API Status

```
GET /api/status
```

Returns the current status of the API.

### Scrape a Single TikTok URL

```
POST /api/scrape
```

Scrapes a single TikTok URL and saves the data to Supabase.

**Request Body:**
```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

### Scrape Multiple TikTok URLs

```
POST /api/scrape/batch
```

Scrapes multiple TikTok URLs and saves the data to Supabase.

**Request Body:**
```json
{
  "urls": [
    "https://www.tiktok.com/@username1/video/1234567890",
    "https://www.tiktok.com/@username2/video/0987654321"
  ]
}
```

## Authentication

All API endpoints are protected with API key authentication. You need to include your API key in the request:

- As a header: `x-api-key: your-api-key`
- Or as a query parameter: `?apiKey=your-api-key`

## Web Interface

A simple web interface is available at the root URL (`http://localhost:3000`) for easy testing of the API.

## Example Usage

### Using cURL

```bash
# Scrape a single TikTok URL
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"url": "https://www.tiktok.com/@username/video/1234567890"}'

# Scrape multiple TikTok URLs
curl -X POST http://localhost:3000/api/scrape/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"urls": ["https://www.tiktok.com/@username1/video/1234567890", "https://www.tiktok.com/@username2/video/0987654321"]}'
```

### Using JavaScript

```javascript
// Scrape a single TikTok URL
fetch('http://localhost:3000/api/scrape', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key'
  },
  body: JSON.stringify({
    url: 'https://www.tiktok.com/@username/video/1234567890'
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## Vercel Deployment

To deploy this API on Vercel:

1. Fork or clone this repository to your GitHub account.

2. Log in to your Vercel account and create a new project.

3. Import your GitHub repository.

4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `test-crawler` (if your project is in a subdirectory)
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `public`
   - **Install Command**: `npm install`

5. Add the following environment variables:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase API key
   - `API_KEY`: A secret key for API authentication
   - `DEBUG`: Set to `false`
   - `SAVE_LOCAL`: Set to `false` for Vercel deployment
   - `SAVE_SUMMARY`: Set to `true` if you want summaries
   - `HEADLESS`: Set to `true`
   - `USE_SUPABASE_STORAGE`: Set to `true` for Vercel deployment
   - `SAVE_SCREENSHOTS`: Set to `true` if you want screenshots saved to Supabase Storage

6. Click "Deploy" and wait for the deployment to complete.

7. Your API will be available at `https://your-project-name.vercel.app`

### Serverless Limitations

Vercel uses a serverless architecture, which has some limitations:

1. **Execution Time**: Functions have a maximum execution time of 10 seconds on the hobby plan (up to 60 seconds on paid plans).
2. **Background Processing**: Serverless functions stop executing after sending a response, so background processing won't work as expected.
3. **File System Access**: The file system is read-only except for the `/tmp` directory, and changes don't persist between invocations.

For more details, see the [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) file.

### GitHub Actions Deployment

This project includes a GitHub Actions workflow for automated deployments to Vercel. To use this feature:

1. Fork or clone this repository to your GitHub account
2. Set up the following secrets in your GitHub repository settings:
   - `VERCEL_TOKEN`: Your Vercel personal access token
   - `VERCEL_PROJECT_ID`: Your Vercel project ID 
   - `VERCEL_ORG_ID`: Your Vercel organization ID

3. Push changes to the `main` or `master` branch to trigger automatic deployment
4. You can also manually trigger the workflow from the Actions tab in your GitHub repository

The workflow file is located at `.github/workflows/vercel-deploy.yml` if you need to customize it.

#### Getting Vercel Configuration Values

To help you get the necessary Vercel configuration values, this project includes a helper script:

```bash
# Install the Vercel CLI if you haven't already
npm install -g vercel

# Run the configuration helper
npm run vercel-config
```

This script will guide you through the process of obtaining your Vercel organization ID, project ID, and instructions for creating a token.

## Docker Support

You can run the API in a Docker container:

```bash
# Build the Docker image
docker build -t tiktok-to-supabase-api .

# Run the container
docker run -p 3000:3000 --env-file .env tiktok-to-supabase-api
```

## Deployment

For production deployment, consider using a process manager like PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start the API with PM2
pm2 start api.js --name tiktok-api

# Make PM2 start the API on system startup
pm2 startup
pm2 save
``` 