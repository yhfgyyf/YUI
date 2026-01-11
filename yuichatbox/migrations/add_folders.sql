-- Add folder support to YUI ChatBox database
-- This migration creates the folders table and inserts default folder

-- Step 1: Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Step 2: Insert default "未分类" folder
INSERT OR IGNORE INTO folders (id, name, color, created_at, updated_at)
VALUES (
    'default-uncategorized',
    '未分类',
    '#6B7280',
    CAST(strftime('%s', 'now') * 1000 AS INTEGER),
    CAST(strftime('%s', 'now') * 1000 AS INTEGER)
);

-- Note: folder_id column and index are added by Python code after this script
