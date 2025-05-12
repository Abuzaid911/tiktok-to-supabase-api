import { PlaywrightCrawler, Dataset } from 'crawlee';
import fs from 'fs';
import path from 'path';

// Function to extract and transform TikTok video data
function extractTikTokData(rawData) {
    // Initialize with empty values
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

    // Extract from TikTok object if available
    if (rawData.tiktok) {
        videoInfo.username = rawData.tiktok.username || '';
        videoInfo.description = rawData.tiktok.caption || '';
        
        // Extract statistics
        const stats = rawData.tiktok.statistics || {};
        videoInfo.likes = stats.likes || '0';
        videoInfo.comments = stats.comments || '0';
        videoInfo.shares = stats.shares || '0';
        
        // Extract hashtags
        videoInfo.hashtags = rawData.tiktok.hashtags || [];
        
        // Extract video URL if available
        videoInfo.videoUrl = rawData.tiktok.videoUrl || '';
    }
    
    // Extract from metadata (more reliable for some fields)
    if (rawData.metadata) {
        // Extract description from metadata if not found earlier
        if (!videoInfo.description && rawData.metadata['og:description']) {
            videoInfo.description = rawData.metadata['og:description'];
        }
        
        // Extract author/title from metadata
        if (rawData.metadata['og:title']) {
            videoInfo.author = rawData.metadata['og:title'].split(' on TikTok')[0] || '';
        }
        
        // Use full description from metadata
        if (rawData.metadata.description) {
            // Parse description which often contains formatted info
            const metaDesc = rawData.metadata.description;
            videoInfo.fullDescription = metaDesc;
            
            // Try to extract date from description or other metadata
            const dateMatch = metaDesc.match(/\d{1,2}-\d{1,2}/) || [];
            if (dateMatch.length > 0) {
                videoInfo.date = dateMatch[0];
            }
            
            // Extract audio info if present in description
            if (metaDesc.includes('original sound')) {
                const audioMatch = metaDesc.match(/original sound - ([^.]+)/);
                if (audioMatch && audioMatch.length > 1) {
                    videoInfo.audioInfo = audioMatch[1].trim();
                }
            }
        }
        
        // Extract thumbnail URL from og:image if available
        if (rawData.metadata['og:image']) {
            videoInfo.thumbnailUrl = rawData.metadata['og:image'];
        }
    }
    
    // Try to extract title from the page title
    if (rawData.title) {
        const titleParts = rawData.title.split('|');
        if (titleParts.length > 0) {
            videoInfo.title = titleParts[0].trim();
        }
    }
    
    // Look for date in page text if not found yet
    if (!videoInfo.date && rawData.pageTextSample) {
        // Look for common date patterns in text
        // First try MM-DD format
        let dateMatch = rawData.pageTextSample.match(/(\d{1,2})-(\d{1,2})/);
        if (dateMatch) {
            videoInfo.date = dateMatch[0];
        }
    }
    
    return videoInfo;
}

// Function to scrape a single TikTok URL
async function scrapeTikTokUrl(url) {
    console.log(`Starting to scrape TikTok URL: ${url}`);
    
    // Ensure storage directories exist
    const storageDir = path.join(process.cwd(), 'storage');
    const datasetDir = path.join(storageDir, 'datasets', 'default');
    
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }
    
    if (!fs.existsSync(datasetDir)) {
        fs.mkdirSync(datasetDir, { recursive: true });
    }
    
    // Clear previous dataset
    fs.readdirSync(datasetDir)
        .filter(file => file.endsWith('.json'))
        .forEach(file => fs.unlinkSync(path.join(datasetDir, file)));
    
    // Create crawler for TikTok
    const crawler = new PlaywrightCrawler({
        async requestHandler({ request, page, log }) {
            const pageUrl = request.loadedUrl;
            const title = await page.title();
            log.info(`Title of ${pageUrl} is '${title}'`);

            // For TikTok, we need to wait longer for content to load
            await page.evaluate(() => {
                window.scrollBy(0, 500);
            });
            
            // Wait for dynamic content to load
            await page.waitForTimeout(5000);
            
            // Initialize data object
            let data = {
                title,
                url: pageUrl,
            };
            
            try {
                // Take a screenshot for verification
                await page.screenshot({ path: 'storage/tiktok-page.png' });
                
                // Get all text content for analysis
                const pageText = await page.evaluate(() => document.body.innerText);
                data.pageTextSample = pageText.slice(0, 1000);
                
                // Extract username from URL
                const usernameFromUrl = pageUrl.match(/@([^\/]+)/)?.[1] || '';
                data.usernameFromUrl = usernameFromUrl;
                
                // Extract video caption
                const videoCaption = await page.$eval('span[data-e2e="browse-video-desc"]', el => el.innerText).catch(() => {
                    return page.$eval('h1, span.tiktok-j2a19r-SpanText', el => el.innerText);
                }).catch(() => '');
                
                // Extract engagement stats
                const statsTexts = await page.$$eval('strong[data-e2e$="-count"]', els => 
                    els.map(el => ({ 
                        type: el.getAttribute('data-e2e'), 
                        value: el.innerText 
                    }))
                ).catch(() => []);
                
                // Create stats object
                const stats = {};
                statsTexts.forEach(stat => {
                    if (stat.type.includes('like')) stats.likes = stat.value;
                    if (stat.type.includes('comment')) stats.comments = stat.value;
                    if (stat.type.includes('share')) stats.shares = stat.value;
                });
                
                // Extract hashtags
                const hashtags = await page.$$eval('a[href*="/tag/"]', tags => 
                    tags.map(tag => tag.innerText.trim()).filter(text => text.startsWith('#'))
                ).catch(() => []);
                
                // Create the TikTok data object
                data.tiktok = {
                    username: usernameFromUrl,
                    caption: videoCaption,
                    statistics: stats,
                    hashtags
                };
                
                // Try to extract video source URL
                const videoSources = await page.$$eval('video source, video', els => 
                    els.map(el => el.src || el.getAttribute('src')).filter(Boolean)
                ).catch(() => []);
                
                if (videoSources.length > 0) {
                    data.tiktok.videoUrl = videoSources[0];
                }
                
                // Get metadata from page
                data.metadata = await page.evaluate(() => {
                    const metaTags = {};
                    document.querySelectorAll('meta').forEach(meta => {
                        const name = meta.getAttribute('name') || meta.getAttribute('property');
                        const content = meta.getAttribute('content');
                        if (name && content) metaTags[name] = content;
                    });
                    return metaTags;
                });
                
            } catch (error) {
                log.error('Error extracting TikTok data', error);
            }
            
            // Save raw data
            await Dataset.pushData(data);
        },
        headless: false, // Show browser for debugging
        maxRequestsPerCrawl: 1, // Only process the one URL
        navigationTimeoutSecs: 60,
        preNavigationHooks: [
            async ({ page }) => {
                // Add user agent that mimics a real browser
                await page.setExtraHTTPHeaders({
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-User': '?1',
                    'Sec-Fetch-Dest': 'document',
                });
            },
        ],
    });

    // Run the crawler
    await crawler.run([url]);
    console.log('Crawler finished.');
    
    // Process the data
    try {
        const files = fs.readdirSync(datasetDir).filter(file => file.endsWith('.json'));
        
        if (files.length === 0) {
            console.log('No dataset files found.');
            return null;
        }
        
        // Process each file (should just be one)
        for (const file of files) {
            const filePath = path.join(datasetDir, file);
            const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Extract the TikTok data
            const videoInfo = extractTikTokData(rawData);
            
            // Save processed data to a new file with timestamp
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const outputPath = path.join(storageDir, `tiktok-video-info-${timestamp}.json`);
            fs.writeFileSync(outputPath, JSON.stringify(videoInfo, null, 2));
            
            console.log(`\nExtracted Video Information for ${url}:`);
            console.log(JSON.stringify(videoInfo, null, 2));
            
            return videoInfo;
        }
    } catch (error) {
        console.error('Error processing TikTok data:', error);
        return null;
    }
}

// If this script is run directly, check for command line argument
if (process.argv.length > 2) {
    const url = process.argv[2];
    scrapeTikTokUrl(url);
} else {
    console.log('Please provide a TikTok URL as a command-line argument.');
    console.log('Example: node tiktok-scraper.js https://www.tiktok.com/@username/video/1234567890');
}

// Export the function for use in other scripts
export default scrapeTikTokUrl; 