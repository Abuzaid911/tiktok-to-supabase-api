# TikTok to Supabase API Documentation

This API allows you to scrape TikTok videos and store the data in Supabase with a simple HTTP request.

## Base URL

```
http://localhost:3000
```

## Authentication

All API endpoints are protected with API key authentication. You need to include your API key in the request:

- As a header: `x-api-key: your-api-key`
- Or as a query parameter: `?apiKey=your-api-key`

You can set your API key in the `.env` file:

```
API_KEY=your-secret-api-key
```

## Endpoints

### Check API Status

```
GET /api/status
```

Returns the current status of the API.

#### Response

```json
{
  "status": "online",
  "timestamp": "2023-05-12T18:30:24.894Z"
}
```

### Scrape a Single TikTok URL

```
POST /api/scrape
```

Scrapes a single TikTok URL and saves the data to Supabase.

#### Request Body

```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

#### Response

```json
{
  "success": true,
  "message": "Processing started",
  "url": "https://www.tiktok.com/@username/video/1234567890",
  "timestamp": "2023-05-12T18:30:24.894Z"
}
```

### Scrape Multiple TikTok URLs

```
POST /api/scrape/batch
```

Scrapes multiple TikTok URLs and saves the data to Supabase.

#### Request Body

```json
{
  "urls": [
    "https://www.tiktok.com/@username1/video/1234567890",
    "https://www.tiktok.com/@username2/video/0987654321"
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Batch processing started",
  "count": 2,
  "timestamp": "2023-05-12T18:30:24.894Z"
}
```

## Error Responses

### Invalid URL

```json
{
  "success": false,
  "error": "Invalid or missing TikTok URL"
}
```

### Invalid API Key

```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing API key"
}
```

### Server Error

```json
{
  "success": false,
  "error": "Internal server error"
}
```

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

// Scrape multiple TikTok URLs
fetch('http://localhost:3000/api/scrape/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key'
  },
  body: JSON.stringify({
    urls: [
      'https://www.tiktok.com/@username1/video/1234567890',
      'https://www.tiktok.com/@username2/video/0987654321'
    ]
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
``` 