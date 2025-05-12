-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create TikTok videos table
CREATE TABLE IF NOT EXISTS tiktok_videos (
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
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_tiktok_id ON tiktok_videos(tiktok_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function on update
DROP TRIGGER IF EXISTS update_tiktok_videos_updated_at ON tiktok_videos;
CREATE TRIGGER update_tiktok_videos_updated_at
BEFORE UPDATE ON tiktok_videos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create RPC function for table creation (for programmatic use)
CREATE OR REPLACE FUNCTION create_tiktok_table(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I (
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
        
        CREATE INDEX IF NOT EXISTS idx_%I_tiktok_id ON %I(tiktok_id);
    ', table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 