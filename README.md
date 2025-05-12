# TikTok to Supabase API

A REST API that scrapes TikTok videos and stores the data in Supabase.

## Features

- Scrape TikTok videos and extract metadata
- Store data in Supabase database
- Simple REST API endpoints
- Web interface for easy testing
- Support for batch processing
- Serverless deployment support (Vercel)
- GitHub Actions for automated deployment

## Quick Start

1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`
4. Set up your Supabase project and create the table using `create-supabase-table.sql`
5. Run the storage setup: `npm run setup-storage`
6. Start the API: `npm start`

## Documentation

For detailed documentation, see:

- [API Documentation](./API_README.md)
- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)

## Deployment Options

### Vercel Deployment

This project is optimized for Vercel deployment. See the [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md) for instructions.

### GitHub Actions

Automated deployment to Vercel is set up using GitHub Actions. Configure the following secrets in your repository:

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_ORG_ID`

Run `npm run vercel-config` to get these values.

### Docker

```bash
# Build the Docker image
docker build -t tiktok-to-supabase-api .

# Run the container
docker run -p 3000:3000 --env-file .env tiktok-to-supabase-api
```

## License

MIT 