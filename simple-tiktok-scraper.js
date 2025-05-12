import playwright from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Simple TikTok scraper that extracts video information
 */

// Function to extract video information from a TikTok page
async function extractTikTokData(url) {
    console.log(`Starting to scrape TikTok URL: ${url}`);
    
    // Initialize the transformed data object
    const videoInfo = {
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
    
    // Launch browser
    const browser = await playwright.chromium.launch({
        headless: false // Show browser for debugging
    });
    
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
        
        // Take a screenshot for verification
        const screenshotPath = path.join(process.cwd(), 'tiktok-page.png');
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to: ${screenshotPath}`);
        
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

// Main function to process TikTok URLs
async function processTikTokUrl(url) {
    // Make sure it's a TikTok URL
    if (!url.includes('tiktok.com')) {
        console.error('Error: Not a valid TikTok URL');
        return null;
    }
    
    try {
        // Extract data from the TikTok page
        const videoInfo = await extractTikTokData(url);
        
        // Create output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), 'results');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Save to a file
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputPath = path.join(outputDir, `tiktok-${videoInfo.username || 'video'}-${timestamp}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(videoInfo, null, 2));
        
        console.log(`\nExtracted Video Information for ${url}:`);
        console.log(JSON.stringify(videoInfo, null, 2));
        console.log(`\nResults saved to: ${outputPath}`);
        
        return videoInfo;
    } catch (error) {
        console.error('Error processing TikTok URL:', error);
        return null;
    }
}

// Command-line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Please provide a TikTok URL.');
        console.log('Usage: node simple-tiktok-scraper.js <tiktok-url>');
        process.exit(1);
    }
    
    const url = args[0];
    await processTikTokUrl(url);
}

// Run the scraper if this script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

// Export the function for use in other scripts
export default processTikTokUrl; 