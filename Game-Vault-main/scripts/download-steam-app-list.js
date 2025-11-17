/**
 * Script to download the Steam app list and save it as a local JSON file
 * This provides a backup when the Steam API is unavailable
 * 
 * Usage: node scripts/download-steam-app-list.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const APP_LIST_FILE = path.join(DATA_DIR, 'steam-app-list.json');

async function downloadSteamAppList() {
    console.log('🔄 Downloading Steam app list...');
    
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log(`📁 Created data directory: ${DATA_DIR}`);
    }
    
    // Try Steam API first (try both v2 and v1)
    const steamAppListUrlV2 = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';
    const steamAppListUrlV1 = 'https://api.steampowered.com/ISteamApps/GetAppList/v0001/';
    
    try {
        console.log('   Attempting to fetch from Steam API (v2)...');
        let response;
        let apps;
        
        try {
            response = await axios.get(steamAppListUrlV2, {
                timeout: 60000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.applist && response.data.applist.apps) {
                apps = response.data.applist.apps;
            } else {
                throw new Error('Unexpected v2 format');
            }
        } catch (v2Error) {
            console.log(`   v2 failed: ${v2Error.message}, trying v1...`);
            response = await axios.get(steamAppListUrlV1, {
                timeout: 60000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.applist && response.data.applist.apps) {
                apps = response.data.applist.apps;
            } else {
                throw new Error('Unexpected v1 format');
            }
        }
        
        if (apps && apps.length > 0) {
            console.log(`✅ Successfully downloaded ${apps.length} games from Steam API`);
            
            // Save to file
            const dataToSave = {
                source: 'Steam API',
                downloadedAt: new Date().toISOString(),
                appCount: apps.length,
                apps: apps
            };
            
            fs.writeFileSync(APP_LIST_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
            console.log(`💾 Saved to: ${APP_LIST_FILE}`);
            console.log(`✅ Download complete! ${apps.length} games saved.`);
            
            return apps;
        } else {
            throw new Error('No apps found in Steam API response');
        }
    } catch (apiError) {
        console.log(`   Steam API failed: ${apiError.message}`);
        console.log('   Trying alternative: Community-maintained Steam app list...');
        
        // Fallback: Try community-maintained source (steamappidlist on GitHub)
        try {
            const communityUrl = 'https://raw.githubusercontent.com/jsnli/steamappidlist/main/steamappidlist.json';
            console.log('   Fetching from community-maintained source...');
            const response = await axios.get(communityUrl, {
                timeout: 60000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data) {
                // The format might be different, try to extract apps
                let apps = [];
                
                if (Array.isArray(response.data)) {
                    // If it's already an array
                    apps = response.data.map(item => ({
                        appid: item.appid || item.id || item.appId,
                        name: item.name || item.Name || item.gameName
                    })).filter(app => app.appid && app.name);
                } else if (response.data.applist && response.data.applist.apps) {
                    // Steam API format
                    apps = response.data.applist.apps;
                } else if (response.data.apps && Array.isArray(response.data.apps)) {
                    // Custom format with apps array
                    apps = response.data.apps;
                } else if (typeof response.data === 'object') {
                    // Try to extract from object keys (appid as keys)
                    apps = Object.entries(response.data).map(([key, value]) => ({
                        appid: parseInt(key) || key,
                        name: typeof value === 'string' ? value : (value.name || value.Name || key)
                    })).filter(app => app.appid && app.name);
                }
                
                if (apps.length > 0) {
                    console.log(`✅ Successfully downloaded ${apps.length} games from community source`);
                    
                    // Save to file
                    const dataToSave = {
                        source: 'Community (steamappidlist)',
                        downloadedAt: new Date().toISOString(),
                        appCount: apps.length,
                        apps: apps
                    };
                    
                    fs.writeFileSync(APP_LIST_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
                    console.log(`💾 Saved to: ${APP_LIST_FILE}`);
                    console.log(`✅ Download complete! ${apps.length} games saved.`);
                    
                    return apps;
                } else {
                    throw new Error('No apps found in response');
                }
            }
        } catch (communityError) {
            console.error(`   Community source failed: ${communityError.message}`);
            console.log('   Trying SteamDB as last resort...');
            
            // Last resort: Try SteamDB
            try {
                const steamDbUrl = 'https://raw.githubusercontent.com/SteamDatabase/SteamTracking/master/AppList.json';
                const response = await axios.get(steamDbUrl, {
                    timeout: 60000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.data && Array.isArray(response.data)) {
                    const apps = response.data.map(item => ({
                        appid: item.appid || item.id,
                        name: item.name || item.Name
                    })).filter(app => app.appid && app.name);
                    
                    console.log(`✅ Successfully downloaded ${apps.length} games from SteamDB`);
                    
                    // Save to file
                    const dataToSave = {
                        source: 'SteamDB',
                        downloadedAt: new Date().toISOString(),
                        appCount: apps.length,
                        apps: apps
                    };
                    
                    fs.writeFileSync(APP_LIST_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
                    console.log(`💾 Saved to: ${APP_LIST_FILE}`);
                    console.log(`✅ Download complete! ${apps.length} games saved.`);
                    
                    return apps;
                }
            } catch (steamDbError) {
                console.error(`   SteamDB also failed: ${steamDbError.message}`);
                throw new Error('All sources failed');
            }
        }
    }
}

// Run the download
downloadSteamAppList()
    .then(() => {
        console.log('\n✅ Steam app list download completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Failed to download Steam app list:', error.message);
        console.error('   The server will still work but searches may be slower.');
        process.exit(1);
    });

