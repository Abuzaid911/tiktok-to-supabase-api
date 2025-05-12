import fs from 'fs';
import path from 'path';

// Function to extract and format TikTok video data
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
        views: 'N/A', // TikTok doesn't always show view count directly
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
            // Look for date patterns in page text sample
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
        
        // Try looking for dates in other formats (like "Posted on" or specific patterns)
        if (!videoInfo.date) {
            // Look for dates in page text using various regex patterns
            // Pattern for dates like "4-20" (commonly used on TikTok)
            const monthDayPattern = /\b(\d{1,2})-(\d{1,2})\b/;
            dateMatch = rawData.pageTextSample.match(monthDayPattern);
            if (dateMatch) {
                // Add current year to make it more complete
                const currentYear = new Date().getFullYear();
                videoInfo.date = `${currentYear}-${dateMatch[0]}`;
            }
        }
    }
    
    return videoInfo;
}

// Main function to process datasets
async function processDatasets() {
    const datasetDir = path.join(process.cwd(), 'storage', 'datasets', 'default');
    
    try {
        // Read all JSON files in the dataset directory
        const files = fs.readdirSync(datasetDir).filter(file => file.endsWith('.json'));
        
        if (files.length === 0) {
            console.log('No dataset files found.');
            return;
        }
        
        console.log(`Found ${files.length} dataset files.`);
        
        // Process each file
        const processedData = [];
        
        for (const file of files) {
            const filePath = path.join(datasetDir, file);
            const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Only process TikTok data
            if (rawData.url && rawData.url.includes('tiktok.com')) {
                const videoInfo = extractTikTokData(rawData);
                processedData.push(videoInfo);
                console.log(`Processed TikTok data from ${file}`);
            }
        }
        
        // Save processed data to a new file
        const outputPath = path.join(process.cwd(), 'storage', 'tiktok-video-info.json');
        fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2));
        
        console.log(`Processed ${processedData.length} TikTok videos. Results saved to: ${outputPath}`);
        
        // Also display the data in console
        console.log('\nExtracted Video Information:');
        console.log(JSON.stringify(processedData[0], null, 2));
    } catch (error) {
        console.error('Error processing datasets:', error);
    }
}

// Run the processor
processDatasets(); 