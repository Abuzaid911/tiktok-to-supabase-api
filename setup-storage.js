import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const BUCKET_NAME = 'tiktok-data';

// Initialize Supabase client
const initSupabase = () => {
    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: Supabase URL and key must be provided in .env file');
        console.error('Please create a .env file with SUPABASE_URL and SUPABASE_KEY');
        process.exit(1);
    }
    
    return createClient(supabaseUrl, supabaseKey);
};

// Check if bucket exists and create it if needed
async function setupStorage() {
    try {
        console.log(`Checking if storage bucket '${BUCKET_NAME}' exists...`);
        
        const supabase = initSupabase();
        
        // List buckets to check if our bucket exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error('Error listing storage buckets:', listError);
            return false;
        }
        
        // Check if our bucket exists
        const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);
        
        if (bucketExists) {
            console.log(`Bucket '${BUCKET_NAME}' already exists.`);
        } else {
            console.log(`Creating bucket '${BUCKET_NAME}'...`);
            
            // Create the bucket
            const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                public: false,
                allowedMimeTypes: ['image/png', 'application/json'],
                fileSizeLimit: 5242880 // 5MB
            });
            
            if (createError) {
                console.error('Error creating storage bucket:', createError);
                return false;
            }
            
            console.log(`Bucket '${BUCKET_NAME}' created successfully.`);
        }
        
        // Create folders within the bucket
        console.log('Creating folders within the bucket...');
        
        const folders = ['results', 'screenshots', 'summaries'];
        
        for (const folder of folders) {
            // Create an empty file to establish the folder
            const { error: folderError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(`${folder}/.keep`, new Uint8Array(0), {
                    contentType: 'text/plain',
                    upsert: true
                });
                
            if (folderError) {
                console.error(`Error creating folder '${folder}':`, folderError);
            } else {
                console.log(`Folder '${folder}' created successfully.`);
            }
        }
        
        console.log('Storage setup completed successfully.');
        return true;
    } catch (error) {
        console.error('Error setting up storage:', error);
        return false;
    }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    setupStorage().then(success => {
        if (!success) {
            console.error('Storage setup failed.');
            process.exit(1);
        }
    }).catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export { setupStorage }; 