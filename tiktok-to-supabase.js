import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import playwright from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const TIKTOK_TABLE_NAME = 'tiktok_videos';
const isServerless = process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Initialize Supabase client
const initSupabase = () => {
    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: Supabase URL and key must be provided in .env file');
        console.error('Please create a .env file with SUPABASE_URL and SUPABASE_KEY');
        process.exit(1);
    }
    
    return createClient(supabaseUrl, supabaseKey);
};

// Function to extract video information from a TikTok page
async function extractTikTokData(url) {
    console.log(`Starting to scrape TikTok URL: ${url}`);
    
    // Initialize the transformed data object
    const videoInfo = {
        url,
        author: '',
        username: '',
        title: '',
        description: '',
        likes: '0',
        comments: '0',
        shares: '0',
        views: 'N/A',
        hashtags: [],
        date: '',
        videoUrl: '',
        thumbnailUrl: '',
        audioInfo: '',
    };
    
    // Launch browser with appropriate options based on environment
    const launchOptions = {
        headless: process.env.DEBUG !== 'true', // Show browser only in debug mode
    };
    
    // In serverless environments, use different browser launch options
    if (isServerless) {
        launchOptions.args = [
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--single-process',
            '--no-zygote'
        ];
    }
    
    const browser = await playwright.chromium.launch(launchOptions);
    
    try {
        // Create a new page
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });
        const page = await context.newPage();
        
        // Navigate to the TikTok URL
        await page.goto(url, { timeout: 60000 });
        
        // Wait for content to load
        await page.waitForTimeout(5000);
        
        // Scroll to ensure content loads
        await page.evaluate(() => {
            window.scrollBy(0, 500);
        });
        
        // Wait a bit more after scrolling
        await page.waitForTimeout(2000);
        
        // Take a screenshot for verification if in debug mode
        if (process.env.DEBUG === 'true') {
            const screenshotPath = isServerless 
                ? path.join(os.tmpdir(), 'tiktok-page.png')
                : path.join(process.cwd(), 'tiktok-page.png');
                
            await page.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved to: ${screenshotPath}`);
            
            // If in serverless environment and using Supabase, upload the screenshot
            if (isServerless && process.env.SAVE_SCREENSHOTS === 'true') {
                try {
                    const supabase = initSupabase();
                    const timestamp = new Date().toISOString().replace(/:/g, '-');
                    const fileName = `screenshots/tiktok-${timestamp}.png`;
                    
                    const screenshotBuffer = await fs.promises.readFile(screenshotPath);
                    
                    const { data, error } = await supabase.storage
                        .from('tiktok-data')
                        .upload(fileName, screenshotBuffer, {
                            contentType: 'image/png',
                            upsert: true
                        });
                        
                    if (error) {
                        console.error('Error uploading screenshot to Supabase:', error);
                    } else {
                        console.log(`Screenshot uploaded to Supabase: ${fileName}`);
                    }
                } catch (err) {
                    console.error('Error handling screenshot in serverless environment:', err);
                }
            }
        }
        
        // Extract basic information
        const title = await page.title();
        videoInfo.title = title.split('|')[0].trim();
        
        // Extract username from URL
        const usernameMatch = url.match(/@([^\/]+)/);
        if (usernameMatch && usernameMatch.length > 1) {
            videoInfo.username = usernameMatch[1];
        }
        
        // Get page HTML for analysis and use alternative methods
        const pageHtml = await page.content();
        const pageText = await page.evaluate(() => document.body.innerText);
        
        // Extract video caption using multiple selectors and fallbacks
        try {
            // Try different selectors for the caption
            for (const selector of [
                'span[data-e2e="browse-video-desc"]', 
                'h1', 
                'span.tiktok-j2a19r-SpanText',
                'div[data-e2e="browse-video-desc"]',
                'div[class*="DivContainer"] > span'
            ]) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        const text = await element.innerText();
                        if (text && text.trim()) {
                            videoInfo.description = text.trim();
                            break;
                        }
                    }
                } catch (e) {
                    // Continue trying other selectors
                }
            }
            
            // If still not found, try regex approach on the page content
            if (!videoInfo.description) {
                // Look for patterns that might be captions (between quotation marks in meta description)
                const quotedTextMatch = pageHtml.match(/"([^"]{10,100})"/);
                if (quotedTextMatch && quotedTextMatch.length > 1) {
                    videoInfo.description = quotedTextMatch[1];
                }
            }
        } catch (error) {
            console.log('Could not extract video caption:', error.message);
        }
        
        // Extract engagement stats using more flexible approach
        try {
            // Try to get like count
            const likeSelectors = [
                'strong[data-e2e="like-count"]',
                'span[data-e2e="like-count"]',
                'div[data-e2e="like-count"]',
                'button[data-e2e*="like"] span'
            ];
            
            for (const selector of likeSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        const text = await element.innerText();
                        if (text && text.trim() && /^\d+(\.\d+)?[KMBkmb]?$/.test(text.trim())) {
                            videoInfo.likes = text.trim();
                            break;
                        }
                    }
                } catch (e) {
                    // Try next selector
                }
            }
            
            // If still not found, try to extract from text
            if (videoInfo.likes === '0') {
                const likeMatch = pageText.match(/(\d+(\.\d+)?[KMB]?) likes/i);
                if (likeMatch && likeMatch.length > 1) {
                    videoInfo.likes = likeMatch[1];
                }
            }
            
            // Similar approach for comments and shares
            const commentSelectors = [
                'strong[data-e2e="comment-count"]',
                'span[data-e2e="comment-count"]',
                'div[data-e2e="comment-count"]'
            ];
            
            for (const selector of commentSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        const text = await element.innerText();
                        if (text && text.trim() && /^\d+(\.\d+)?[KMBkmb]?$/.test(text.trim())) {
                            videoInfo.comments = text.trim();
                            break;
                        }
                    }
                } catch (e) {
                    // Try next selector
                }
            }
            
            // Extract share count
            const shareSelectors = [
                'strong[data-e2e="share-count"]',
                'span[data-e2e="share-count"]',
                'div[data-e2e="share-count"]'
            ];
            
            for (const selector of shareSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        const text = await element.innerText();
                        if (text && text.trim()) {
                            videoInfo.shares = text.trim();
                            break;
                        }
                    }
                } catch (e) {
                    // Try next selector
                }
            }
        } catch (error) {
            console.log('Could not extract all engagement stats:', error.message);
        }
        
        // Extract hashtags using both selectors and regex
        try {
            // Try to extract using selectors
            const hashtagElements = await page.$$('a[href*="/tag/"]');
            const hashtags = [];
            
            for (const element of hashtagElements) {
                const text = await element.innerText();
                if (text && text.trim().startsWith('#')) {
                    hashtags.push(text.trim());
                }
            }
            
            if (hashtags.length > 0) {
                videoInfo.hashtags = hashtags;
            } else {
                // Try regex approach if no hashtags found
                const hashtagRegex = /#[a-zA-Z0-9_]+/g;
                const hashtagMatches = videoInfo.description.match(hashtagRegex) || [];
                if (hashtagMatches.length > 0) {
                    videoInfo.hashtags = hashtagMatches;
                }
            }
        } catch (error) {
            console.log('Could not extract hashtags:', error.message);
        }
        
        // Extract metadata from the page
        const metadata = await page.evaluate(() => {
            const metaTags = {};
            document.querySelectorAll('meta').forEach(meta => {
                const name = meta.getAttribute('name') || meta.getAttribute('property');
                const content = meta.getAttribute('content');
                if (name && content) metaTags[name] = content;
            });
            return metaTags;
        });
        
        // Extract additional information from metadata
        if (metadata) {
            // Save the entire metadata for debugging/reference
            videoInfo.rawMetadata = metadata;
            
            // Extract author from og:title
            if (metadata['og:title']) {
                videoInfo.author = metadata['og:title'].split(' on TikTok')[0] || '';
            }
            
            // Extract description from og:description if not found earlier
            if (!videoInfo.description && metadata['og:description']) {
                videoInfo.description = metadata['og:description'];
            }
            
            // Extract thumbnail URL from og:image
            if (metadata['og:image']) {
                videoInfo.thumbnailUrl = metadata['og:image'];
            }
            
            // Extract date from text
            if (metadata.description) {
                const dateMatch = metadata.description.match(/\d{1,2}-\d{1,2}/);
                if (dateMatch) {
                    videoInfo.date = dateMatch[0];
                }
                
                // Extract audio info if present in description
                if (metadata.description.includes('original sound')) {
                    const audioMatch = metadata.description.match(/original sound - ([^.]+)/);
                    if (audioMatch && audioMatch.length > 1) {
                        videoInfo.audioInfo = audioMatch[1].trim();
                    }
                }
            }
        }
        
        // Look for date in page text if not found yet
        if (!videoInfo.date) {
            const dateMatch = pageText.match(/\b(\d{1,2})-(\d{1,2})\b/);
            if (dateMatch) {
                videoInfo.date = dateMatch[0];
            }
        }
        
        // Try to extract video URL
        try {
            const videoElements = await page.$$('video');
            for (const video of videoElements) {
                const src = await video.getAttribute('src');
                if (src) {
                    videoInfo.videoUrl = src;
                    break;
                }
            }
            
            // If not found, try source elements
            if (!videoInfo.videoUrl) {
                const sourceElements = await page.$$('source');
                for (const source of sourceElements) {
                    const src = await source.getAttribute('src');
                    if (src) {
                        videoInfo.videoUrl = src;
                        break;
                    }
                }
            }
        } catch (error) {
            console.log('Could not extract video URL:', error.message);
        }
        
        // Add full description from metadata
        if (metadata && metadata.description) {
            videoInfo.fullDescription = metadata.description;
        }
        
        // Try to extract view count from text
        const viewMatches = pageText.match(/(\d+(\.\d+)?[KMB]?) views/i);
        if (viewMatches && viewMatches.length > 1) {
            videoInfo.views = viewMatches[1];
        }
        
    } catch (error) {
        console.error('Error scraping TikTok:', error);
    } finally {
        // Close the browser
        await browser.close();
    }
    
    return videoInfo;
}

// Function to save TikTok data to Supabase
async function saveTikTokData(supabase, videoData) {
    try {
        // Extract TikTok ID from the URL
        const tiktokId = videoData.url.match(/\/video\/(\d+)/)?.[1] || 
                       videoData.url.split('/').pop().split('?')[0];
        
        if (!tiktokId) {
            console.error('Could not extract TikTok ID from URL:', videoData.url);
            return null;
        }
        
        // Prepare the data for insertion
        const dataToInsert = {
            tiktok_id: tiktokId,
            username: videoData.username || '',
            author: videoData.author || '',
            title: videoData.title || '',
            description: videoData.description || '',
            likes: videoData.likes || '0',
            comments: videoData.comments || '0',
            shares: videoData.shares || '0',
            views: videoData.views || 'N/A',
            hashtags: videoData.hashtags || [],
            date: videoData.date || '',
            video_url: videoData.videoUrl || '',
            thumbnail_url: videoData.thumbnailUrl || '',
            audio_info: videoData.audioInfo || '',
            full_description: videoData.fullDescription || '',
            raw_metadata: videoData.rawMetadata || {}
        };
        
        // Insert data with upsert (update if exists, insert if not)
        const { data, error } = await supabase
            .from(TIKTOK_TABLE_NAME)
            .upsert(dataToInsert, { 
                onConflict: 'tiktok_id',
                returning: 'minimal' 
            });
        
        if (error) {
            console.error('Error saving TikTok data:', error);
            return null;
        }
        
        console.log(`TikTok video data saved successfully for ID: ${tiktokId}`);
        return tiktokId;
    } catch (error) {
        console.error('Exception while saving TikTok data:', error);
        return null;
    }
}

// Function to save results locally or to Supabase Storage
async function saveResults(videoData, supabase) {
    try {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `tiktok-${videoData.username || 'video'}-${timestamp}.json`;
        const jsonData = JSON.stringify(videoData, null, 2);
        
        // For local development, save to local file system
        if (process.env.SAVE_LOCAL === 'true' && !isServerless) {
            const resultsDir = path.join(process.cwd(), 'results');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }
            
            const outputPath = path.join(resultsDir, filename);
            fs.writeFileSync(outputPath, jsonData);
            console.log(`Results saved locally to: ${outputPath}`);
        }
        
        // For serverless environments or if explicitly configured, save to Supabase Storage
        if ((isServerless || process.env.USE_SUPABASE_STORAGE === 'true') && supabase) {
            const { data, error } = await supabase.storage
                .from('tiktok-data')
                .upload(`results/${filename}`, jsonData, {
                    contentType: 'application/json',
                    upsert: true
                });
                
            if (error) {
                console.error('Error uploading results to Supabase Storage:', error);
            } else {
                console.log(`Results saved to Supabase Storage: results/${filename}`);
            }
        }
    } catch (error) {
        console.error('Error saving results:', error);
    }
}

// Main function to scrape and save TikTok data
async function scrapeAndSaveTikTok(url) {
    try {
        // Initialize Supabase client
        const supabase = initSupabase();
        
        // Extract data from TikTok
        const videoData = await extractTikTokData(url);
        
        if (!videoData) {
            console.error('Failed to extract TikTok data');
            return {
                success: false,
                error: 'Failed to extract TikTok data'
            };
        }
        
        // Save results
        await saveResults(videoData, supabase);
        
        // Save to Supabase
        const tiktokId = await saveTikTokData(supabase, videoData);
        
        return {
            success: !!tiktokId,
            tiktokId,
            videoData
        };
    } catch (error) {
        console.error('Error in scrapeAndSaveTikTok:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Process multiple TikTok URLs
async function processMultipleUrls(urls) {
    const results = [];
    
    for (const url of urls) {
        console.log(`Processing URL: ${url}`);
        const result = await scrapeAndSaveTikTok(url);
        results.push({
            url,
            ...result
        });
    }
    
    // Save summary if configured
    if (process.env.SAVE_SUMMARY === 'true') {
        try {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const summaryFilename = `tiktok-summary-${timestamp}.json`;
            const jsonData = JSON.stringify(results, null, 2);
            
            // For local development, save to local file system
            if (!isServerless) {
                const summaryPath = path.join(process.cwd(), summaryFilename);
                fs.writeFileSync(summaryPath, jsonData);
                console.log(`Summary saved to: ${summaryPath}`);
            }
            
            // For serverless environments, save to Supabase Storage
            if (isServerless) {
                const supabase = initSupabase();
                const { data, error } = await supabase.storage
                    .from('tiktok-data')
                    .upload(`summaries/${summaryFilename}`, jsonData, {
                        contentType: 'application/json',
                        upsert: true
                    });
                    
                if (error) {
                    console.error('Error uploading summary to Supabase Storage:', error);
                } else {
                    console.log(`Summary saved to Supabase Storage: summaries/${summaryFilename}`);
                }
            }
        } catch (error) {
            console.error('Error saving summary:', error);
        }
    }
    
    return results;
}

// Command-line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Please provide at least one TikTok URL.');
        console.log('Usage: node tiktok-to-supabase.js <tiktok-url> [<tiktok-url2> ...]');
        console.log('Or provide a file with URLs: node tiktok-to-supabase.js --file urls.txt');
        process.exit(1);
    }
    
    let urls = [];
    
    // Check if a file with URLs is provided
    if (args[0] === '--file' && args.length > 1) {
        const filePath = args[1];
        if (!fs.existsSync(filePath)) {
            console.error(`Error: File ${filePath} does not exist`);
            process.exit(1);
        }
        
        urls = fs.readFileSync(filePath, 'utf8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && line.includes('tiktok.com'));
        
        if (urls.length === 0) {
            console.error('No valid TikTok URLs found in the file');
            process.exit(1);
        }
        
        console.log(`Found ${urls.length} TikTok URLs in the file`);
    } else {
        // Use command-line arguments as URLs
        urls = args.filter(arg => arg.includes('tiktok.com'));
        
        if (urls.length === 0) {
            console.error('No valid TikTok URLs provided');
            process.exit(1);
        }
    }
    
    // Process all URLs
    const results = await processMultipleUrls(urls);
    
    // Print summary
    const successful = results.filter(r => r.success).length;
    console.log(`\nProcessing complete: ${successful} out of ${urls.length} URLs successfully processed`);
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export { scrapeAndSaveTikTok, processMultipleUrls }; 