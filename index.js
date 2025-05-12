import { PlaywrightCrawler, Dataset } from 'crawlee';

// Define the website to crawl
// const startUrl = 'https://news.ycombinator.com/';
// const startUrl = 'https://www.reddit.com/r/programming/';
// const startUrl = 'https://github.com/trending';
const startUrl = 'https://www.tiktok.com/@nadaaao160/video/7495477038715833608?is_from_webapp=1&sender_device=pc';

// PlaywrightCrawler crawls the web using a headless
// browser controlled by the Playwright library.
const crawler = new PlaywrightCrawler({
    // Use the requestHandler to process each of the crawled pages.
    async requestHandler({ request, page, enqueueLinks, log }) {
        const url = request.loadedUrl;
        const title = await page.title();
        log.info(`Title of ${url} is '${title}'`);

        let data = {
            title,
            url,
        };

        // Extract data based on the site we're crawling
        if (url.includes('news.ycombinator.com')) {
            // Extract Hacker News specific data
            const stories = await page.$$eval('.athing', (items) => {
                return items.map((item, index) => {
                    const titleElement = item.querySelector('.titleline > a');
                    const siteElement = item.querySelector('.sitestr');
                    
                    // For score and user, we need to look at the next sibling element
                    const nextRow = item.nextElementSibling;
                    const scoreElement = nextRow ? nextRow.querySelector('.score') : null;
                    const userElement = nextRow ? nextRow.querySelector('.hnuser') : null;
                    
                    return {
                        title: titleElement ? titleElement.innerText : '',
                        link: titleElement ? titleElement.href : '',
                        site: siteElement ? siteElement.innerText : '',
                        score: scoreElement ? scoreElement.innerText : 'No score',
                        user: userElement ? userElement.innerText : 'Unknown',
                    };
                });
            });
            
            data.stories = stories;
        } 
        else if (url.includes('reddit.com')) {
            // Extract Reddit specific data
            const posts = await page.$$eval('shreddit-post', (items) => {
                return items.map(item => {
                    return {
                        title: item.getAttribute('post-title') || '',
                        votes: item.getAttribute('score') || '0',
                        comments: item.getAttribute('comment-count') || '0',
                    };
                });
            });
            
            data.posts = posts;
        }
        else if (url.includes('github.com')) {
            // Extract GitHub specific data
            const repos = await page.$$eval('article.Box-row', (items) => {
                return items.map(item => {
                    const titleElement = item.querySelector('h2 a');
                    const descriptionElement = item.querySelector('p');
                    const languageElement = item.querySelector('[itemprop="programmingLanguage"]');
                    const starsElement = item.querySelector('a[href$="/stargazers"]');
                    
                    return {
                        name: titleElement ? titleElement.innerText.trim() : '',
                        description: descriptionElement ? descriptionElement.innerText.trim() : '',
                        language: languageElement ? languageElement.innerText.trim() : 'Unknown',
                        stars: starsElement ? starsElement.innerText.trim() : '0',
                    };
                });
            });
            
            data.repos = repos;
        }
        else if (url.includes('tiktok.com')) {
            // For TikTok, we need to wait longer for content to load
            // Scroll down to ensure all content is loaded
            await page.evaluate(() => {
                window.scrollBy(0, 500);
            });
            
            // Wait a bit longer for dynamic content to load
            await page.waitForTimeout(5000);
            
            // Extract TikTok specific data
            try {
                // Take a screenshot for debugging
                await page.screenshot({ path: 'storage/tiktok-page.png' });
                
                // Get all text content for debugging
                const pageText = await page.evaluate(() => document.body.innerText);
                data.pageTextSample = pageText.slice(0, 1000);
                
                // Get HTML structure for debugging
                const pageHtml = await page.evaluate(() => document.documentElement.outerHTML);
                data.htmlStructure = pageHtml.slice(0, 1000);
                
                // Try to get the username from URL and page
                const usernameFromUrl = url.match(/@([^\/]+)/)?.[1] || '';
                data.usernameFromUrl = usernameFromUrl;
                
                // Extract video caption
                const videoCaption = await page.$eval('span[data-e2e="browse-video-desc"]', el => el.innerText).catch(() => {
                    return page.$eval('h1, span.tiktok-j2a19r-SpanText', el => el.innerText);
                }).catch(() => '');
                
                // Extract engagement stats using more general selectors
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
                
                // Extract hashtags by looking for text starting with #
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
                // Even if extraction fails, we'll still have the basic page data
            }
        }
        else {
            // Generic extraction for other sites
            const bodyText = await page.evaluate(() => document.body.innerText);
            data.bodyTextSnippet = bodyText.slice(0, 200);
        }
        
        // Save results as JSON to ./storage/datasets/default
        await Dataset.pushData(data);

        // For TikTok, we don't need to follow links
        if (!url.includes('tiktok.com')) {
            // Extract links from the current page and add them to the crawling queue
            // Only follow links within the same domain
            const domain = new URL(startUrl).hostname;
            await enqueueLinks({
                globs: [`**${domain}**`],
                transformRequestFunction: (req) => {
                    // Limit the number of pages we'll crawl
                    req.userData.depth = request.userData.depth ? request.userData.depth + 1 : 1;
                    return req;
                },
                strategy: 'same-domain',
            });
        }
    },
    // Uncomment this option to see the browser window.
    // headless: false,
    headless: false, // Let's see the browser for TikTok debugging
    
    // Limit crawl to 10 pages max
    maxRequestsPerCrawl: 10,
    
    // Add custom headers to appear more browser-like
    preNavigationHooks: [
        async ({ request, page }) => {
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
            
            // Don't go deeper than 2 levels
            const depth = request.userData.depth || 0;
            if (depth > 2) return false;
        },
    ],
    // Increase navigation timeout for TikTok
    navigationTimeoutSecs: 120
});

// Add first URL to the queue and start the crawl.
await crawler.run([startUrl]);

console.log('Crawler finished. Check the ./storage/datasets/default directory for results.'); 