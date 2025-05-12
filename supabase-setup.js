import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Table name for TikTok data
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

// Create the TikTok videos table if it doesn't exist
const createTikTokTable = async (supabase) => {
    console.log(`Setting up ${TIKTOK_TABLE_NAME} table...`);
    
    // Using Supabase's SQL execution capability to create the table if it doesn't exist
    const { error } = await supabase.rpc('create_tiktok_table', {
        table_name: TIKTOK_TABLE_NAME
    });
    
    if (error) {
        console.error('Error creating table:', error);
        
        // If the RPC function doesn't exist, we'll need to create it first
        console.log('Creating RPC function for table creation...');
        
        const { error: rpcError } = await supabase.rpc('create_rpc_function');
        
        if (rpcError) {
            console.error('Error creating RPC function:', rpcError);
            console.log('You may need to manually create the table in the Supabase dashboard.');
            console.log(`
                CREATE TABLE IF NOT EXISTS ${TIKTOK_TABLE_NAME} (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    tiktok_id TEXT UNIQUE NOT NULL,
                    username TEXT NOT NULL,
                    author TEXT,
                    title TEXT,
                    description TEXT,
                    likes TEXT,
                    comments TEXT,
                    shares TEXT,
                    views TEXT,
                    hashtags JSONB,
                    date TEXT,
                    video_url TEXT,
                    thumbnail_url TEXT,
                    audio_info TEXT,
                    full_description TEXT,
                    raw_metadata JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Create an index on tiktok_id for faster lookups
                CREATE INDEX IF NOT EXISTS idx_tiktok_videos_tiktok_id ON ${TIKTOK_TABLE_NAME}(tiktok_id);
                
                -- Create a function to automatically update the updated_at timestamp
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                
                -- Create a trigger to call the function on update
                DROP TRIGGER IF EXISTS update_tiktok_videos_updated_at ON ${TIKTOK_TABLE_NAME};
                CREATE TRIGGER update_tiktok_videos_updated_at
                BEFORE UPDATE ON ${TIKTOK_TABLE_NAME}
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
            `);
        } else {
            // Try creating the table again
            const { error: retryError } = await supabase.rpc('create_tiktok_table', {
                table_name: TIKTOK_TABLE_NAME
            });
            
            if (retryError) {
                console.error('Error creating table on retry:', retryError);
            } else {
                console.log('Table created successfully!');
            }
        }
    } else {
        console.log('Table setup completed successfully!');
    }
};

// Function to save TikTok data to Supabase
const saveTikTokData = async (supabase, videoData) => {
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
};

// Function to process a results directory and save all TikTok data
const processResultsDirectory = async (supabase, directory = './results') => {
    try {
        if (!fs.existsSync(directory)) {
            console.error(`Directory ${directory} does not exist`);
            return;
        }
        
        const files = fs.readdirSync(directory).filter(file => file.endsWith('.json'));
        
        if (files.length === 0) {
            console.log('No JSON files found in the results directory');
            return;
        }
        
        console.log(`Found ${files.length} JSON files to process`);
        
        let successCount = 0;
        
        for (const file of files) {
            try {
                const filePath = path.join(directory, file);
                const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                // Add the URL to the data if it's not there
                if (!fileData.url && file.includes('tiktok-')) {
                    const usernameMatch = file.match(/tiktok-([^-]+)-/);
                    if (usernameMatch && usernameMatch[1]) {
                        const username = usernameMatch[1];
                        fileData.url = `https://www.tiktok.com/@${username}/video/unknown`;
                    }
                }
                
                if (fileData.url || fileData.username) {
                    const result = await saveTikTokData(supabase, fileData);
                    if (result) {
                        successCount++;
                    }
                } else {
                    console.log(`Skipping file ${file} - missing URL or username`);
                }
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
        }
        
        console.log(`Successfully saved ${successCount} out of ${files.length} TikTok videos`);
    } catch (error) {
        console.error('Error processing results directory:', error);
    }
};

// Main function to run the script
const main = async () => {
    try {
        const supabase = initSupabase();
        
        // Create the table if it doesn't exist
        await createTikTokTable(supabase);
        
        // Process any existing results
        await processResultsDirectory(supabase);
        
        console.log('Supabase setup completed!');
    } catch (error) {
        console.error('Error in main function:', error);
    }
};

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export { initSupabase, saveTikTokData, TIKTOK_TABLE_NAME }; 