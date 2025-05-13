import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapeAndSaveTikTok, processMultipleUrls } from './tiktok-to-supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API key middleware for security
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    console.warn('WARNING: No API_KEY set in environment variables. API is unsecured!');
    return next();
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API key'
    });
  }
  
  next();
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    message: 'TikTok to Supabase API is running',
    endpoints: {
      '/api/scrape': 'POST - Scrape a single TikTok URL',
      '/api/scrape/batch': 'POST - Scrape multiple TikTok URLs',
      '/api/status': 'GET - Check API status'
    }
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development'
  });
});

// Scrape a single TikTok URL
app.post('/api/scrape', apiKeyAuth, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('tiktok.com')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing TikTok URL'
      });
    }
    
    // Start processing in the background
    console.log(`Received request to scrape: ${url}`);
    
    // Send immediate response
    res.json({
      success: true,
      message: 'Processing started',
      url,
      timestamp: new Date().toISOString()
    });
    
    // Process in the background
    // Note: In serverless environments like Vercel, background processing
    // will be cut off after the response is sent. For production use,
    // consider using a queue service like AWS SQS or a webhook approach.
    try {
      const result = await scrapeAndSaveTikTok(url);
      if (result.success) {
        console.log(`Successfully processed URL: ${url}`);
        console.log(`TikTok ID: ${result.tiktokId}`);
      } else {
        console.error(`Failed to process URL: ${url}`);
        console.error(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error processing URL: ${url}`);
      console.error(error);
    }
    
  } catch (error) {
    console.error('Error in /api/scrape endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Scrape multiple TikTok URLs
app.post('/api/scrape/batch', apiKeyAuth, async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing URLs array'
      });
    }
    
    const validUrls = urls.filter(url => url && url.includes('tiktok.com'));
    
    if (validUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid TikTok URLs provided'
      });
    }
    
    // Start processing in the background
    console.log(`Received request to scrape ${validUrls.length} URLs`);
    
    // Send immediate response
    res.json({
      success: true,
      message: 'Batch processing started',
      count: validUrls.length,
      timestamp: new Date().toISOString()
    });
    
    // Process in the background
    // Note: In serverless environments like Vercel, background processing
    // will be cut off after the response is sent. For production use,
    // consider using a queue service like AWS SQS or a webhook approach.
    try {
      const results = await processMultipleUrls(validUrls);
      const successful = results.filter(r => r.success).length;
      console.log(`Batch processing complete: ${successful} out of ${validUrls.length} URLs successfully processed`);
    } catch (error) {
      console.error('Error in batch processing:', error);
    }
    
  } catch (error) {
    console.error('Error in /api/scrape/batch endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`TikTok to Supabase API running on port ${PORT}`);
    console.log(`API Documentation available at http://localhost:${PORT}`);
  });
}
// Diagnostic endpoint to test Supabase connection
app.get('/api/supabase-test', async (req, res) => {
  try {
    console.log('Testing Supabase connection');
    
    // Import the supabase client
    const { createClient } = await import('@supabase/supabase-js');
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase credentials not found',
        envVars: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_KEY: !!process.env.SUPABASE_KEY
        }
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test connection by adding a test record
    const testData = {
      tiktok_id: 'test-' + Date.now(),
      username: 'test_user',
      title: 'Test record',
      description: 'Testing Supabase connection from Vercel',
      created_at: new Date().toISOString()
    };
    
    console.log('Inserting test record:', testData);
    
    const { data, error } = await supabase
      .from('tiktok_videos')
      .insert(testData)
      .select();
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Supabase test failed',
        error: error.message,
        details: error
      });
    }
    
    return res.json({
      success: true,
      message: 'Supabase connection successful',
      data: data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Supabase test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Supabase test failed',
      error: error.message,
      stack: process.env.DEBUG === 'true' ? error.stack : undefined
    });
  }
});

// Diagnostic endpoint to test scraping
app.get('/api/test-scrape', async (req, res) => {
  try {
    // Log the request
    console.log('Test scrape endpoint called');
    
    // Minimal TikTok URL for testing
    const testUrl = 'https://www.tiktok.com/@aganeena/video/7414810040390962439';
    
    console.log(`Starting test scrape for ${testUrl}`);
    
    // Import the scraper function directly
    const { scrapeAndSaveTikTok } = await import('./tiktok-to-supabase.js');
    
    // Start the scraping process
    const result = await scrapeAndSaveTikTok(testUrl, true);
    
    // Include detailed information in the response
    return res.json({
      success: true,
      message: 'Test scrape completed',
      scraperResult: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test scrape error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test scrape failed',
      error: error.message,
      stack: process.env.DEBUG === 'true' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Export for Vercel
export default app; 
