import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const TIKTOK_TABLE_NAME = 'tiktok_videos';

// Initialize Supabase client
const initSupabase = () => {
    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: Supabase URL and key must be provided in .env file');
        console.error('Please create a .env file with SUPABASE_URL and SUPABASE_KEY');
        process.exit(1);
    }
    
    return createClient(supabaseUrl, supabaseKey);
};

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

// Function to process all JSON files in a directory
async function processResultsDirectory(supabase, directoryPath) {
    console.log(`Processing files in directory: ${directoryPath}`);
    
    // Check if directory exists
    if (!fs.existsSync(directoryPath)) {
        console.error(`Directory does not exist: ${directoryPath}`);
        return 0;
    }
    
    // Get all JSON files in the directory
    const files = fs.readdirSync(directoryPath)
        .filter(file => file.endsWith('.json'));
    
    if (files.length === 0) {
        console.log('No JSON files found in the directory.');
        return 0;
    }
    
    console.log(`Found ${files.length} JSON files to process.`);
    
    let successCount = 0;
    
    // Process each file
    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        console.log(`Processing file: ${file}`);
        
        try {
            // Read and parse the JSON file
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const videoData = JSON.parse(fileContent);
            
            // Save to Supabase
            const tiktokId = await saveTikTokData(supabase, videoData);
            
            if (tiktokId) {
                successCount++;
            }
        } catch (error) {
            console.error(`Error processing file ${file}:`, error.message);
        }
    }
    
    console.log(`Successfully processed ${successCount} out of ${files.length} files.`);
    return successCount;
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    
    // Default directory is './results'
    let directoryPath = path.join(process.cwd(), 'results');
    
    // Check if a custom directory path is provided
    if (args.length > 0) {
        directoryPath = args[0];
    }
    
    console.log(`Starting to upload existing TikTok data from: ${directoryPath}`);
    
    try {
        // Initialize Supabase client
        const supabase = initSupabase();
        
        // Process all files in the directory
        await processResultsDirectory(supabase, directoryPath);
        
        console.log('Upload process completed.');
    } catch (error) {
        console.error('Error during upload process:', error);
        process.exit(1);
    }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
} 