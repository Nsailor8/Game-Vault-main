/**
 * Helper script to convert various Steam app list formats to our standard format
 * 
 * Usage:
 * 1. Place your downloaded Steam app list JSON in: data/steam-app-list-raw.json
 * 2. Run: node scripts/convert-steam-app-list.js
 * 3. The converted file will be saved as: data/steam-app-list.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_FILE = path.join(DATA_DIR, 'steam-app-list-raw.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'steam-app-list.json');

function convertAppList() {
    console.log('🔄 Converting Steam app list...');
    
    // Check if raw file exists
    if (!fs.existsSync(RAW_FILE)) {
        console.error(`❌ File not found: ${RAW_FILE}`);
        console.log('\n📝 Instructions:');
        console.log('1. Download a Steam app list JSON file from GitHub or another source');
        console.log('2. Save it as: data/steam-app-list-raw.json');
        console.log('3. Run this script again');
        process.exit(1);
    }
    
    try {
        console.log(`📖 Reading file: ${RAW_FILE}`);
        const fileData = fs.readFileSync(RAW_FILE, 'utf8');
        const rawData = JSON.parse(fileData);
        
        console.log('🔍 Analyzing file format...');
        let apps = [];
        
        // Try different formats
        if (Array.isArray(rawData)) {
            // Format 1: Direct array
            console.log('   Detected: Array format');
            apps = rawData.map(item => ({
                appid: item.appid || item.id || item.appId || item.AppID,
                name: item.name || item.Name || item.gameName || item.GameName || String(item)
            })).filter(app => app.appid && app.name);
        } else if (rawData.applist && rawData.applist.apps) {
            // Format 2: Steam API format
            console.log('   Detected: Steam API format (applist.apps)');
            apps = rawData.applist.apps;
        } else if (rawData.apps && Array.isArray(rawData.apps)) {
            // Format 3: Custom format with apps array
            console.log('   Detected: Custom format (apps array)');
            apps = rawData.apps;
        } else if (typeof rawData === 'object') {
            // Format 4: Object with appid as keys
            console.log('   Detected: Object format (appid as keys)');
            apps = Object.entries(rawData).map(([key, value]) => ({
                appid: parseInt(key) || key,
                name: typeof value === 'string' ? value : (value.name || value.Name || key)
            })).filter(app => app.appid && app.name);
        } else {
            throw new Error('Unknown file format');
        }
        
        // Clean and validate apps
        apps = apps.map(app => ({
            appid: parseInt(app.appid) || app.appid,
            name: String(app.name || '').trim()
        })).filter(app => {
            // Filter out invalid entries
            if (!app.appid || !app.name) return false;
            if (isNaN(app.appid) && typeof app.appid !== 'string') return false;
            if (app.name.length === 0) return false;
            return true;
        });
        
        console.log(`✅ Extracted ${apps.length} valid games`);
        
        if (apps.length === 0) {
            console.error('❌ No valid games found in the file!');
            console.log('\nThe file might be in an unexpected format.');
            console.log('Please check the file structure and try again.');
            process.exit(1);
        }
        
        // Create output in our standard format
        const output = {
            source: 'Manual Download (Converted)',
            downloadedAt: new Date().toISOString(),
            appCount: apps.length,
            apps: apps
        };
        
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        
        // Save converted file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
        
        console.log(`💾 Saved converted file: ${OUTPUT_FILE}`);
        console.log(`✅ Conversion complete! ${apps.length} games ready to use.`);
        console.log('\n📝 Next steps:');
        console.log('1. Restart your server');
        console.log('2. The server will automatically use this file');
        console.log('3. You should see: "✅ Loaded X games from local backup file"');
        
        // Show sample of first few games
        console.log('\n📋 Sample games:');
        apps.slice(0, 5).forEach((app, i) => {
            console.log(`   ${i + 1}. [${app.appid}] ${app.name}`);
        });
        
    } catch (error) {
        console.error('❌ Error converting file:', error.message);
        console.error('\nPlease check:');
        console.error('1. The file is valid JSON');
        console.error('2. The file contains Steam app data');
        console.error('3. The file is not corrupted');
        process.exit(1);
    }
}

// Run conversion
convertAppList();

