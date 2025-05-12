#!/usr/bin/env node
import scrapeTikTokUrl from './tiktok-scraper.js';
import fs from 'fs';

/**
 * A simple command-line interface for the TikTok scraper
 * 
 * Usage: 
 *   node extract-tiktok.js <tiktok-url>
 *   node extract-tiktok.js --batch urls.txt
 */

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Please provide a TikTok URL or use --batch with a file containing URLs.');
        console.log('Usage:');
        console.log('  node extract-tiktok.js <tiktok-url>');
        console.log('  node extract-tiktok.js --batch urls.txt');
        process.exit(1);
    }
    
    // Handle batch mode
    if (args[0] === '--batch' && args.length > 1) {
        const batchFile = args[1];
        
        if (!fs.existsSync(batchFile)) {
            console.error(`Error: File ${batchFile} does not exist.`);
            process.exit(1);
        }
        
        const urls = fs.readFileSync(batchFile, 'utf8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && line.includes('tiktok.com'));
        
        if (urls.length === 0) {
            console.error('No valid TikTok URLs found in the batch file.');
            process.exit(1);
        }
        
        console.log(`Found ${urls.length} TikTok URLs in the batch file.`);
        
        const results = [];
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(`\nProcessing URL ${i+1}/${urls.length}: ${url}`);
            
            try {
                const videoInfo = await scrapeTikTokUrl(url);
                if (videoInfo) {
                    results.push({
                        url,
                        videoInfo
                    });
                }
            } catch (error) {
                console.error(`Error processing ${url}:`, error.message);
            }
        }
        
        // Save all results to a single file
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputPath = `storage/tiktok-batch-results-${timestamp}.json`;
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        
        console.log(`\nBatch processing complete. Results saved to ${outputPath}`);
        console.log(`Successfully processed ${results.length} out of ${urls.length} URLs.`);
    }
    // Handle single URL mode
    else {
        const url = args[0];
        
        if (!url.includes('tiktok.com')) {
            console.error('Error: Please provide a valid TikTok URL.');
            console.log('Example: https://www.tiktok.com/@username/video/1234567890');
            process.exit(1);
        }
        
        try {
            await scrapeTikTokUrl(url);
        } catch (error) {
            console.error('Error processing TikTok URL:', error.message);
            process.exit(1);
        }
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
}); 