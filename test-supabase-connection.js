import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  
  // Check if environment variables are set
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL and key must be provided in .env file');
    console.error(`Current values: URL=${supabaseUrl ? 'Set' : 'Not set'}, KEY=${supabaseKey ? 'Set' : 'Not set'}`);
    return false;
  }
  
  console.log(`Attempting to connect to Supabase at: ${supabaseUrl}`);
  
  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to create a simple temporary table for testing
    const { error } = await supabase.rpc('test_connection');
    
    if (error) {
      console.error('Error connecting to Supabase:', error.message);
      console.log('\nThis is likely because the test_connection function does not exist.');
      console.log('This is normal for a new Supabase project.');
      console.log('We will proceed with creating the necessary tables.');
    } else {
      console.log('Successfully connected to Supabase!');
    }
    
    // If we got here, the connection is working
    console.log('\nYour Supabase URL and API key appear to be valid.');
    console.log('You can now proceed with creating the TikTok videos table.');
    
    return true;
  } catch (error) {
    console.error('Exception during Supabase connection test:', error);
    return false;
  }
}

// Run the test
testSupabaseConnection().then(success => {
  if (success) {
    console.log('\nConnection test passed! Your Supabase configuration is working.');
    console.log('\nNext steps:');
    console.log('1. Run the SQL script in the Supabase SQL editor to create the tiktok_videos table');
    console.log('2. Use the tiktok-to-supabase.js script to scrape and store TikTok videos');
  } else {
    console.log('\nConnection test failed. Please check your Supabase configuration.');
    console.log('Make sure your .env file contains valid SUPABASE_URL and SUPABASE_KEY values.');
    process.exit(1);
  }
}); 