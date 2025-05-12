import { scrapeAndSaveTikTok, processMultipleUrls } from './tiktok-to-supabase.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Example TikTok URLs to scrape
const testUrls = [
  'https://www.tiktok.com/@tiktok/video/7106594312292453675',
  'https://www.tiktok.com/@charlidamelio/video/7106315915522731306'
];

// Test single URL scraping
async function testSingleUrl() {
  console.log('Testing single URL scraping and saving to Supabase...');
  
  const result = await scrapeAndSaveTikTok(testUrls[0]);
  
  if (result.success) {
    console.log(`Successfully scraped and saved TikTok video with ID: ${result.tiktokId}`);
    console.log('Video data:', JSON.stringify(result.videoData, null, 2));
  } else {
    console.error('Failed to scrape or save TikTok video:', result.error);
  }
}

// Test multiple URL processing
async function testMultipleUrls() {
  console.log('\nTesting multiple URL processing...');
  
  const results = await processMultipleUrls(testUrls);
  
  console.log(`\nProcessed ${results.length} URLs:`);
  results.forEach((result, index) => {
    console.log(`\n[${index + 1}] URL: ${result.url}`);
    console.log(`Success: ${result.success ? 'Yes' : 'No'}`);
    if (result.success) {
      console.log(`TikTok ID: ${result.tiktokId}`);
      console.log(`Author: ${result.videoData.author}`);
      console.log(`Title: ${result.videoData.title}`);
      console.log(`Likes: ${result.videoData.likes}`);
    } else {
      console.log(`Error: ${result.error || 'Unknown error'}`);
    }
  });
}

// Main test function
async function runTests() {
  try {
    // Uncomment the test you want to run
    await testSingleUrl();
    // await testMultipleUrls();
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run tests
runTests().catch(console.error); 