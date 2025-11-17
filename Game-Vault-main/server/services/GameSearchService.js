const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

class GameSearchService {
    constructor() {
        // Steam API configuration (no API key needed for public Store API)
        this.steamApiBase = 'https://api.steampowered.com';
        this.steamStoreBase = 'https://store.steampowered.com/api';
        
        // Circuit breaker for Steam API rate limiting
        this.steamApiBlocked = false;
        this.consecutive403Errors = 0;
        this.maxConsecutive403Errors = 5;
        
        // Cache for Steam app list
        this.appListCache = null;
        this.appListCacheTime = null;
        this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours
        
        // Track if app list is currently being loaded
        this.appListLoading = false;
        this.appListLoadingPromise = null;
        
        // Note: Preload is handled by server.js after database initialization
        // to avoid blocking server startup
    }

    async searchGames(query, page = 1, pageSize = 20) {
        try {
            // Check if Steam API is blocked
            if (this.steamApiBlocked) {
                console.log('⚠️ [Search] Steam API is currently blocked');
                return {
                    success: false,
                    games: [],
                    totalResults: 0,
                    currentPage: page,
                    totalPages: 0,
                    isMockData: false,
                    error: 'Steam API is temporarily unavailable. Please try again in a few minutes.'
                };
            }

            // Only use Steam API for search - never use mock data
            console.log(`🔍 [Search] Using Steam API for search: "${query}"`);
            const result = await this.searchGamesWithSteam(query, page, pageSize);
            
            // If we got an error result, return it as-is (don't fall back to mock)
            if (result.success === false) {
                return result;
            }
            
            return result;
        } catch (error) {
            console.error(`❌ [Search] Error searching Steam games:`, error.message);
            console.error(`   Stack:`, error.stack?.split('\n').slice(0, 3).join('\n'));
            
            // Return error instead of mock data
            return {
                success: false,
                games: [],
                totalResults: 0,
                currentPage: page,
                totalPages: 0,
                isMockData: false,
                error: `Search failed: ${error.message}. Please try again.`
            };
        }
    }

    async searchGamesWithSteam(query, page = 1, pageSize = 20) {
        // Declare outside try block so it's accessible in catch
        let gamesWithDetails = [];
        let matchingGames = [];
        
        try {
            console.log(`🔍 [Steam Search] Searching for: "${query}"`);
            
            // Get Steam app list - try to load if not available
            console.log(`📋 [Steam Search] Checking app list cache...`);
            console.log(`   Cache exists: ${!!this.appListCache}`);
            console.log(`   Cache count: ${this.appListCache ? this.appListCache.length : 0}`);
            console.log(`   Is loading: ${this.appListLoading}`);
            console.log(`   Is blocked: ${this.steamApiBlocked}`);
            
            let appList;
            try {
                appList = await this.getSteamAppList();
            } catch (error) {
                console.error('❌ [Steam Search] Failed to get app list:', error.message);
                console.error(`   Error type: ${error.constructor.name}`);
                if (error.code === 'ECONNABORTED') {
                    return {
                        success: false,
                        games: [],
                        totalResults: 0,
                        currentPage: page,
                        totalPages: 0,
                        isMockData: false,
                        error: 'Steam API timeout. The app list is taking too long to load. Please wait a moment and try again.'
                    };
                }
                if (error.response && error.response.status === 404) {
                    return {
                        success: false,
                        games: [],
                        totalResults: 0,
                        currentPage: page,
                        totalPages: 0,
                        isMockData: false,
                        error: 'Steam API endpoint not found. Please check server configuration.'
                    };
                }
                throw error; // Re-throw to be caught by outer catch
            }
            
            console.log(`📋 [Steam Search] Got app list: ${appList ? appList.length : 0} games`);
            
            // If app list is empty, use Steam Store API search directly
            if (!appList || appList.length === 0) {
                console.log('📡 [Steam Search] App list is empty, using Steam Store API search directly...');
                return await this.searchSteamStoreDirect(query, page, pageSize);
            }
            
            console.log(`📦 [Steam Search] Using app list with ${appList.length} games`);
            
            // Debug: Check if app list has games with "cyberpunk" in name
            if (query.toLowerCase().includes('cyberpunk')) {
                const cyberpunkGames = appList.filter(app => 
                    app.name && app.name.toLowerCase().includes('cyberpunk')
                );
                console.log(`🔍 [Debug] Found ${cyberpunkGames.length} games with "cyberpunk" in app list`);
                if (cyberpunkGames.length > 0) {
                    console.log(`🔍 [Debug] Sample cyberpunk games:`, cyberpunkGames.slice(0, 5).map(g => g.name));
                }
            }

            // Search app list for matching games (case-insensitive, word-based matching)
            const searchLower = query.toLowerCase().trim();
            const searchWords = searchLower.split(/\s+/).filter(word => word.length > 0);
            
            console.log(`🔍 [Steam Search] Searching for: "${query}" (lowercase: "${searchLower}", words: [${searchWords.join(', ')}])`);
            
            matchingGames = appList.filter(app => {
                if (!app.name) return false;
                
                const gameNameLower = app.name.toLowerCase();
                
                // Exact match (highest priority)
                if (gameNameLower === searchLower) {
                    return true;
                }
                
                // Contains the full query as substring
                if (gameNameLower.includes(searchLower)) {
                    return true;
                }
                
                // Word-based matching: all search words must appear in the game name
                if (searchWords.length > 0) {
                    const allWordsMatch = searchWords.every(word => 
                        gameNameLower.includes(word)
                    );
                    if (allWordsMatch) {
                        return true;
                    }
                }
                
                // Fuzzy matching: check if game name starts with any search word
                if (searchWords.length > 0) {
                    const startsWithWord = searchWords.some(word => 
                        gameNameLower.startsWith(word)
                    );
                    if (startsWithWord) {
                        return true;
                    }
                }
                
                return false;
            });

            console.log(`📊 [Steam Search] Found ${matchingGames.length} matching games in app list for query "${query}"`);
            if (matchingGames.length > 0 && matchingGames.length <= 10) {
                console.log(`📊 [Steam Search] Matching games:`, matchingGames.map(g => g.name));
            }

            // Sort matches by relevance (best matches first)
            matchingGames.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                
                // Exact match gets highest priority
                if (aName === searchLower && bName !== searchLower) return -1;
                if (bName === searchLower && aName !== searchLower) return 1;
                
                // Games starting with query get high priority
                const aStarts = aName.startsWith(searchLower);
                const bStarts = bName.startsWith(searchLower);
                if (aStarts && !bStarts) return -1;
                if (bStarts && !aStarts) return 1;
                
                // Games containing full query get medium priority
                const aContains = aName.includes(searchLower);
                const bContains = bName.includes(searchLower);
                if (aContains && !bContains) return -1;
                if (bContains && !aContains) return 1;
                
                // Shorter names (more likely to be exact) get priority
                return aName.length - bName.length;
            });

            // Limit to first 100 matches for better results (increased from 50)
            const maxGamesToFetch = Math.min(100, matchingGames.length);
            const gamesToFetch = matchingGames.slice(0, maxGamesToFetch);

            // Get detailed information for games - optimized for speed
            const batchSize = 5; // Increased batch size for parallel processing
            const delayBetweenRequests = 100; // Reduced from 300ms to 100ms
            const delayBetweenBatches = 200; // Reduced from 1000ms to 200ms
            gamesWithDetails = [];
            const maxGamesToTry = Math.min(maxGamesToFetch, gamesToFetch.length);

            // Process games in parallel batches for better performance
            for (let i = 0; i < maxGamesToTry; i += batchSize) {
                // Check circuit breaker
                if (this.steamApiBlocked) {
                    console.log('⚠️ [Steam Search] Steam API blocked during search');
                    break;
                }
                
                const batch = gamesToFetch.slice(i, i + batchSize);
                
                // Process batch in parallel (much faster)
                const batchPromises = batch.map(async (game) => {
                    try {
                        const details = await this.getSteamGameDetails(game.appid);
                        if (details) {
                            const formattedGame = this.formatSteamGameData(game, details);
                            // Be less strict - include games even if they don't have background images
                            // We'll filter later if needed, but show more results
                            if (formattedGame && formattedGame.name) {
                                // Include games with or without images for now
                                gamesWithDetails.push(formattedGame);
                                // Reset error counter on success
                                this.consecutive403Errors = 0;
                                return formattedGame;
                            }
                        }
                        return null;
                    } catch (error) {
                        // Log but continue - don't fail entire search for individual game errors
                        // Only log if it's not a common error (like 404)
                        if (error.response?.status !== 404) {
                            console.log(`⚠️ Skipping app ${game.appid} (${game.name}) due to error: ${error.message}`);
                        }
                        return null;
                    }
                });
                
                // Wait for batch to complete
                await Promise.all(batchPromises);
                
                // Small delay between batches to avoid rate limiting (reduced significantly)
                if (i + batchSize < maxGamesToTry) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                }
            }

            console.log(`📊 [Steam Search] Fetched details for ${gamesWithDetails.length} games`);

            // Filter out invalid games but keep games without images (we'll prioritize ones with images)
            gamesWithDetails = gamesWithDetails.filter(game => game && game.name);
            
            // If we got no games with details, return empty results
            if (gamesWithDetails.length === 0) {
                console.log(`⚠️ [Steam Search] No games found for query: "${query}"`);
                console.log(`   Matching games in app list: ${matchingGames.length}`);
                return {
                    success: true,
                    games: [],
                    totalResults: 0,
                    currentPage: page,
                    totalPages: 0,
                    isMockData: false
                };
            }

            // Use all games (with images prioritized)
            let gamesToSort = gamesWithDetails;

            // Sort by relevance: images first, then by rating/score
            gamesToSort.sort((a, b) => {
                // First priority: games with images
                const aHasImage = !!(a.backgroundImage);
                const bHasImage = !!(b.backgroundImage);
                if (aHasImage && !bHasImage) return -1;
                if (!aHasImage && bHasImage) return 1;
                
                // Second priority: rating score (highest first)
                const scoreA = (a.metacritic || 0) * 10 + (a.rating || 0) * 3 + Math.min(a.ratingsCount || 0, 50000) / 1000;
                const scoreB = (b.metacritic || 0) * 10 + (b.rating || 0) * 3 + Math.min(b.ratingsCount || 0, 50000) / 1000;
                if (scoreB !== scoreA) return scoreB - scoreA;
                
                // Third priority: games with names that match better (shorter names for exact matches)
                return (a.name || '').length - (b.name || '').length;
            });

            // Apply pagination
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const topGames = gamesToSort.slice(startIndex, endIndex);
            
            console.log(`✅ [Steam Search] Returning ${topGames.length} games (page ${page}, ${pageSize} per page, total: ${gamesToSort.length})`);

            return {
                success: true,
                games: topGames,
                totalResults: gamesToSort.length,
                currentPage: page,
                totalPages: Math.ceil(gamesToSort.length / pageSize) || 1,
                isMockData: false
            };
        } catch (error) {
            console.error(`❌ [Steam Search] Error:`, error.message);
            console.error(`   Stack:`, error.stack?.split('\n').slice(0, 3).join('\n'));
            
            // Check if it's a 404 error - handle gracefully
            if (error.response && error.response.status === 404) {
                console.log(`⚠️ [Steam Search] 404 error - Steam API endpoint may have changed or game not found`);
                return {
                    success: true,
                    games: [],
                    totalResults: 0,
                    currentPage: page,
                    totalPages: 0,
                    isMockData: false
                };
            }
            
            // For other errors, check if we got any games before the error
            // If we have some games, return them instead of failing completely
            if (gamesWithDetails && gamesWithDetails.length > 0) {
                // Filter out games without images
                const gamesWithImages = gamesWithDetails.filter(game => game && game.backgroundImage);
                if (gamesWithImages.length > 0) {
                    console.log(`⚠️ [Steam Search] Error occurred but returning ${gamesWithImages.length} games with images found so far`);
                    const topGames = gamesWithImages.slice(0, pageSize);
                    return {
                        success: true,
                        games: topGames,
                        totalResults: gamesWithImages.length,
                        currentPage: page,
                        totalPages: Math.ceil(gamesWithImages.length / pageSize) || 1,
                        isMockData: false
                    };
                }
            }
            
            // Only return error if we have no games at all
            return {
                success: false,
                games: [],
                totalResults: 0,
                currentPage: page,
                totalPages: 0,
                isMockData: false,
                error: `Steam search failed: ${error.message}. Please try again.`
            };
        }
    }

    async getSteamAppList() {
        try {
            // Check cache
            if (this.appListCache && this.appListCacheTime && 
                (Date.now() - this.appListCacheTime) < this.cacheExpiration) {
                console.log(`✅ Using cached Steam app list (${this.appListCache.length} games)`);
                return this.appListCache;
            }

            // If app list is currently being loaded, wait for it
            if (this.appListLoading && this.appListLoadingPromise) {
                console.log('⏳ Steam app list is already being loaded, waiting...');
                return await this.appListLoadingPromise;
            }

            // Start loading the app list
            this.appListLoading = true;
            this.appListLoadingPromise = this._loadSteamAppList();
            
            try {
                const result = await this.appListLoadingPromise;
                return result;
            } finally {
                this.appListLoading = false;
                this.appListLoadingPromise = null;
            }
        } catch (error) {
            this.appListLoading = false;
            this.appListLoadingPromise = null;
            console.error('❌ [getSteamAppList] Error:', error.message);
            if (error.response) {
                console.error(`   Response status: ${error.response.status}`);
            }
            if (error.code) {
                console.error(`   Error code: ${error.code}`);
            }
            throw error;
        }
    }

    async _loadSteamAppList() {
        try {
            console.log('🔄 Loading Steam app list...');
            
            // First, try to load from local backup file
            const dataDir = path.join(__dirname, '..', '..', 'data');
            const appListFile = path.join(dataDir, 'steam-app-list.json');
            
            if (fs.existsSync(appListFile)) {
                try {
                    console.log('   Checking local backup file...');
                    const fileData = fs.readFileSync(appListFile, 'utf8');
                    const jsonData = JSON.parse(fileData);
                    
                    if (jsonData && jsonData.apps && Array.isArray(jsonData.apps) && jsonData.apps.length > 0) {
                        const apps = jsonData.apps;
                        const downloadedAt = jsonData.downloadedAt ? new Date(jsonData.downloadedAt) : null;
                        const daysOld = downloadedAt ? Math.floor((Date.now() - downloadedAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
                        
                        console.log(`✅ Loaded ${apps.length} games from local backup file`);
                        if (downloadedAt) {
                            console.log(`   File downloaded: ${downloadedAt.toLocaleDateString()} (${daysOld !== null ? daysOld + ' days ago' : 'unknown'})`);
                        }
                        
                        // Cache the app list
                        this.appListCache = apps;
                        this.appListCacheTime = Date.now();
                        
                        // If file is older than 7 days, try to update in background (don't wait)
                        if (daysOld !== null && daysOld > 7) {
                            console.log('   ⚠️ Local backup is older than 7 days, attempting to update in background...');
                            this._updateLocalBackupInBackground();
                        }
                        
                        return apps;
                    }
                } catch (fileError) {
                    console.log(`   Local file read failed: ${fileError.message}, trying API...`);
                }
            } else {
                console.log('   No local backup file found, fetching from API...');
            }
            
            // Try to fetch from Steam API
            const steamAppListUrl = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';
            
            try {
                console.log('   Attempting to fetch from Steam API...');
                const response = await axios.get(steamAppListUrl, {
                    timeout: 30000, // 30 second timeout for large file
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.data && response.data.applist && response.data.applist.apps) {
                    const apps = response.data.applist.apps;
                    console.log(`✅ Successfully loaded ${apps.length} games from Steam API`);
                    
                    // Save to local backup file
                    this._saveLocalBackup(apps, 'Steam API');
                    
                    // Cache the app list
                    this.appListCache = apps;
                    this.appListCacheTime = Date.now();
                    
                    return apps;
                } else {
                    console.warn('⚠️ Steam API returned unexpected format, trying alternative source...');
                    throw new Error('Unexpected response format');
                }
            } catch (apiError) {
                console.log(`   Steam API failed: ${apiError.message}`);
                console.log('   Trying alternative: SteamDB community list...');
                
                // Fallback: Try SteamDB's app list (if available)
                // Note: This is a large file, so we use a longer timeout
                try {
                    const steamDbUrl = 'https://raw.githubusercontent.com/SteamDatabase/SteamTracking/master/AppList.json';
                    const response = await axios.get(steamDbUrl, {
                        timeout: 45000, // 45 second timeout
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
                        
                        console.log(`✅ Successfully loaded ${apps.length} games from SteamDB`);
                        
                        // Save to local backup file
                        this._saveLocalBackup(apps, 'SteamDB');
                        
                        // Cache the app list
                        this.appListCache = apps;
                        this.appListCacheTime = Date.now();
                        
                        return apps;
                    }
                } catch (steamDbError) {
                    console.log(`   SteamDB source also failed: ${steamDbError.message}`);
                }
                
                // If all API sources fail, try to use local backup even if we already tried
                if (fs.existsSync(appListFile)) {
                    try {
                        console.log('   Attempting to use local backup file as last resort...');
                        const fileData = fs.readFileSync(appListFile, 'utf8');
                        const jsonData = JSON.parse(fileData);
                        
                        if (jsonData && jsonData.apps && Array.isArray(jsonData.apps) && jsonData.apps.length > 0) {
                            const apps = jsonData.apps;
                            console.log(`✅ Using local backup: ${apps.length} games`);
                            
                            this.appListCache = apps;
                            this.appListCacheTime = Date.now();
                            
                            return apps;
                        }
                    } catch (backupError) {
                        console.log(`   Local backup also failed: ${backupError.message}`);
                    }
                }
                
                // If everything fails, log warning but continue with empty list
                console.warn('⚠️ Could not load Steam app list from any source.');
                console.warn('   Searches will still work but may be slower (using direct Steam Store API).');
                console.warn('   Run "node scripts/download-steam-app-list.js" to create a local backup.');
                
                // Return empty array as fallback - searches will use direct API
                this.appListCache = [];
                this.appListCacheTime = Date.now();
                return [];
            }
        } catch (error) {
            console.error('❌ Error loading Steam app list:', error.message);
            console.error('   Searches will still work but may be slower (using direct Steam Store API).');
            
            // Return empty array as fallback
            this.appListCache = [];
            this.appListCacheTime = Date.now();
            return [];
        }
    }

    _saveLocalBackup(apps, source) {
        try {
            const dataDir = path.join(__dirname, '..', '..', 'data');
            const appListFile = path.join(dataDir, 'steam-app-list.json');
            
            // Ensure data directory exists
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            const dataToSave = {
                source: source,
                downloadedAt: new Date().toISOString(),
                appCount: apps.length,
                apps: apps
            };
            
            fs.writeFileSync(appListFile, JSON.stringify(dataToSave, null, 2), 'utf8');
            console.log(`💾 Saved ${apps.length} games to local backup: ${appListFile}`);
        } catch (error) {
            console.warn(`⚠️ Failed to save local backup: ${error.message}`);
        }
    }

    _updateLocalBackupInBackground() {
        // Don't await - run in background
        setImmediate(async () => {
            try {
                const steamAppListUrl = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';
                const response = await axios.get(steamAppListUrl, {
                    timeout: 30000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.data && response.data.applist && response.data.applist.apps) {
                    const apps = response.data.applist.apps;
                    this._saveLocalBackup(apps, 'Steam API (background update)');
                    console.log(`✅ Background update: Saved ${apps.length} games to local backup`);
                }
            } catch (error) {
                // Silently fail - this is just a background update
                console.log(`   Background update failed: ${error.message}`);
            }
        });
    }

    async searchSteamStoreDirect(query, page = 1, pageSize = 20) {
        try {
            console.log(`🔍 [Steam Store Direct] Searching for: "${query}"`);
            
            // Use Steam Store search suggestions API
            const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
            
            try {
                const response = await axios.get(searchUrl, {
                    timeout: 10000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.data && response.data.items && Array.isArray(response.data.items)) {
                    const items = response.data.items;
                    console.log(`📦 [Steam Store Direct] Found ${items.length} items`);
                    
                    const games = [];
                    for (const item of items.slice(0, Math.min(20, pageSize * 2))) {
                        try {
                            if (item.id) {
                                const details = await this.getSteamGameDetails(item.id);
                                if (details) {
                                    const formattedGame = this.formatSteamGameData(
                                        { appid: item.id, name: item.name || details.name },
                                        details
                                    );
                                    // Only add games that have images
                                    if (formattedGame && formattedGame.backgroundImage) {
                                        games.push(formattedGame);
                                    } else if (formattedGame && !formattedGame.backgroundImage) {
                                        console.log(`⚠️ Skipping ${item.name || item.id} - no image available`);
                                    }
                                } else {
                                    // Skip games without details (they won't have images)
                                    console.log(`⚠️ Skipping ${item.name || item.id} - no details available (no image)`);
                                }
                                // Small delay to avoid rate limiting
                                await new Promise(resolve => setTimeout(resolve, 200));
                            }
                        } catch (err) {
                            console.log(`⚠️ Skipping item ${item.id}: ${err.message}`);
                            continue;
                        }
                    }
                    
                    // Filter out games without images
                    const gamesWithImages = games.filter(game => game && game.backgroundImage);
                    
                    if (gamesWithImages.length > 0) {
                        return {
                            success: true,
                            games: gamesWithImages.slice((page - 1) * pageSize, page * pageSize),
                            totalResults: gamesWithImages.length,
                            currentPage: page,
                            totalPages: Math.ceil(gamesWithImages.length / pageSize) || 1,
                            isMockData: false
                        };
                    }
                }
            } catch (searchError) {
                console.error('❌ [Steam Store Direct] Search API error:', searchError.message);
                // Fall through to return empty results
            }
            
            console.log('⚠️ [Steam Store Direct] No results found');
            return {
                success: true,
                games: [],
                totalResults: 0,
                currentPage: page,
                totalPages: 0,
                isMockData: false
            };
        } catch (error) {
            console.error('❌ [Steam Store Direct] Error:', error.message);
            return {
                success: false,
                games: [],
                totalResults: 0,
                currentPage: page,
                totalPages: 0,
                isMockData: false,
                error: `Search failed: ${error.message}`
            };
        }
    }

    _filterAppList(apps) {
        // Filter out non-games (DLCs, videos, etc. typically have appid < 1000)
        // Also filter out test apps, tools, DLCs, videos, and trailers
        return apps.filter(app => {
            if (!app.name || app.name.trim().length === 0) return false;
            if (app.appid < 1000) return false; // Low app IDs are usually non-games
            
            const name = app.name.toLowerCase();
            
            // Filter out obvious non-games
            const isTest = name.includes('test') || name.startsWith('test ');
            const isServer = name.includes('server') || name.includes('dedicated server');
            const isTool = name.includes('tool') || name.includes('editor') || name.includes('sdk');
            const isDemo = name.includes('demo -') || name.includes('demo:') || name.includes(' demo');
            // Allow game editions - only filter actual DLCs
            const isDLC = name.includes('downloadable content') ||
                         name.includes('expansion pack') ||
                         name.includes('expansion:') ||
                         (name.includes(' - ') && name.split(' - ')[1].toLowerCase().includes('dlc')) ||
                         (name.includes('dlc') && (
                            name.endsWith(' dlc') ||
                            name.includes(' - dlc')
                         ));
            const isVideo = name.includes('trailer') || 
                           name.includes('video') ||
                           name.includes('movie') ||
                           (name.includes('soundtrack') && !name.includes('game')) ||
                           (name.includes('ost') && !name.includes('game'));
            const isHardware = name.includes('hardware') || name.includes('controller');
            
            return !isTest && !isServer && !isTool && !isDemo && !isDLC && !isVideo && !isHardware;
        });
    }

    async getSteamGameDetails(appId, retries = 0) {
        // Don't retry if Steam API is blocked
        if (this.steamApiBlocked) {
            return null;
        }
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    // Exponential backoff: wait longer on each retry
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.log(`Retrying Steam API request for app ID ${appId} (attempt ${attempt + 1}/${retries + 1}) after ${delay}ms delay...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                console.log(`Fetching Steam game details for app ID: ${appId}`);
                const url = `${this.steamStoreBase}/appdetails`;
                const response = await axios.get(url, {
                    params: {
                        appids: appId,
                        l: 'english'
                    },
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    validateStatus: function (status) {
                        // Don't throw for 404, we'll handle it
                        return status < 500; // Accept all status codes < 500
                    }
                });
                
                // Check for 404 explicitly
                if (response.status === 404) {
                    console.log(`⚠️ Steam API returned 404 for app ID ${appId} at ${url}`);
                    return null;
                }

                if (!response.data || !response.data[appId]) {
                    console.log(`No data found for app ID ${appId} in Steam response`);
                    return null;
                }

                const appData = response.data[appId];
                if (appData && appData.success && appData.data) {
                    const gameData = appData.data;
                    
                    // Filter out non-games (DLCs, videos, tools, etc.) - check type field
                    const gameType = gameData.type ? gameData.type.toLowerCase() : '';
                    const isGame = gameType === 'game';
                    const isDLC = gameType === 'dlc' || gameData.type === 'DLC';
                    const isVideo = gameType === 'video' || gameData.type === 'Video' || gameData.type === 'movie' || gameType === 'movie';
                    const isHardware = gameData.type === 'Hardware' || gameType === 'hardware';
                    const isSoftware = gameData.type === 'Software' && !isGame; // Some software are games, some aren't
                    
                    // Also check name for additional filtering - but be careful not to exclude game editions
                    const gameName = gameData.name ? gameData.name.toLowerCase() : '';
                    
                    // Only flag as DLC if it's clearly an expansion/add-on, not a game edition
                    const nameIsDLC = (gameName.includes('dlc') && !gameName.match(/^\w+\s+dlc$/)) || // Exclude "Game DLC" pattern
                                     (gameName.includes('pack') && (
                                        gameName.includes('graphic assets') ||
                                        gameName.includes('texture pack') ||
                                        gameName.includes('asset pack') ||
                                        gameName.includes('content pack')
                                     )) || 
                                     (gameName.includes('expansion') && (
                                        gameName.includes('expansion pack') ||
                                        gameName.includes('expansion:')
                                     )) ||
                                     (gameName.includes('add-on') && !gameName.includes('game'));
                    
                    const nameIsDemo = gameName.includes('demo') && (
                                        gameName.includes(' demo') ||
                                        gameName.includes('demo ') ||
                                        gameName.endsWith(' demo')
                                     );
                    const nameIsVideo = gameName.includes('trailer') || 
                                      (gameName.includes('video') && !gameName.includes('game')) || 
                                      gameName.includes('movie') ||
                                      gameName.includes('film');
                    const nameIsAsset = (gameName.includes('assets') && gameName.includes('pack')) ||
                                       gameName.includes('graphic assets') ||
                                       gameName.includes('texture pack');
                    
                    // Check if it's actually a game - but allow game editions
                    // Only exclude if Steam explicitly says it's not a game AND has clear non-game indicators
                    // OR if it's clearly DLC/video/demo/asset
                    const shouldExclude = (!isGame && (isDLC || isVideo || isHardware)) || 
                                         nameIsDLC || 
                                         nameIsDemo || 
                                         nameIsVideo || 
                                         nameIsAsset;
                    
                    if (shouldExclude) {
                        console.log(`🚫 [Details] Skipping non-game: ${gameData.name} (type: ${gameData.type || 'unknown'}, indicators: DLC=${nameIsDLC}, Demo=${nameIsDemo}, Video=${nameIsVideo}, Asset=${nameIsAsset})`);
                        return null;
                    }
                    
                    // If Steam says it's a game type, trust it
                    // Also allow if type is missing but has game-like properties (name, description, etc.)
                    if (isGame || (!gameData.type && gameData.name && gameData.short_description)) {
                        console.log(`✅ [Details] Including game: ${gameData.name} (type: ${gameData.type || 'unknown - but has game properties'})`);
                    }
                    
                    console.log(`Successfully fetched details for ${gameData.name || appId}`);
                    // Add type to the data so we can use it later
                    gameData._steamType = gameData.type;
                    return gameData;
                } else {
                    console.log(`Steam API returned success=false for app ID ${appId}`);
                    if (appData && appData.data) {
                        const gameData = appData.data;
                        // Check type even if success is false
                        const gameType = gameData.type ? gameData.type.toLowerCase() : '';
                        if (gameType !== 'game' && gameType !== '') {
                            return null; // Skip non-games
                        }
                        // Even if success is false, sometimes data is still available
                        gameData._steamType = gameData.type;
                        return gameData;
                    }
                    return null;
                }
            } catch (error) {
                // Handle 404 errors gracefully - game doesn't exist, just skip it
                if (error.response) {
                    const status = error.response.status;
                    if (status === 404) {
                        console.log(`⚠️ Steam API returned 404 for app ID ${appId} - game may not exist or be removed`);
                        return null; // Skip this game, don't retry
                    }
                    // Log other status codes for debugging
                    if (status !== 403) {
                        console.log(`⚠️ Steam API returned ${status} for app ID ${appId}`);
                    }
                } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    console.log(`⚠️ Steam API timeout for app ID ${appId}`);
                    return null; // Skip on timeout
                }
                
                // Handle 403 errors with circuit breaker
                if (error.response && error.response.status === 403) {
                    this.consecutive403Errors++;
                    
                    // If too many 403s, block Steam API and stop retrying
                    if (this.consecutive403Errors >= this.maxConsecutive403Errors) {
                        this.steamApiBlocked = true;
                        console.log(`🚫 [Steam API] Blocked after ${this.consecutive403Errors} consecutive 403 errors. Using mock data.`);
                        // Reset after 5 minutes
                        setTimeout(() => {
                            this.steamApiBlocked = false;
                            this.consecutive403Errors = 0;
                            console.log('✅ [Steam API] Circuit breaker reset, will try Steam API again');
                        }, 5 * 60 * 1000); // 5 minutes
                        return null;
                    }
                    
                    // Don't retry 403s - they're rate limiting us, retrying makes it worse
                    console.log(`⚠️ Steam API returned 403 for app ID ${appId} (${this.consecutive403Errors}/${this.maxConsecutive403Errors} errors)`);
                    return null;
                }
                
                // For other errors, retry if we have attempts left
                if (attempt < retries) {
                    continue; // Retry on next iteration
                }
                
                // If it's the last attempt, handle the error gracefully
                if (attempt === retries) {
                    console.log(`⚠️ Error fetching Steam game details for ${appId}: ${error.message} (status: ${error.response?.status || 'N/A'})`);
                    return null; // Return null instead of throwing, so search can continue
                }
            }
        }
        
        // If we get here, all retries failed
        console.error(`Error fetching Steam game details for ${appId}: All retries exhausted`);
        return null;
    }

    formatSteamGameData(game, details) {
        // Use details if available, otherwise use basic app list data
        if (details) {
            const releaseInfo = details.release_date || {};
            const rawReleaseDate = typeof releaseInfo.date === 'string' ? releaseInfo.date.trim() : '';
            const comingSoon = !!releaseInfo.coming_soon;
            let releaseDisplay = rawReleaseDate && rawReleaseDate.length > 0 ? rawReleaseDate : (comingSoon ? 'Coming Soon' : 'TBA');
            let releaseTimestamp = null;

            if (!comingSoon && rawReleaseDate) {
                const parsed = Date.parse(rawReleaseDate);
                if (!Number.isNaN(parsed)) {
                    releaseTimestamp = parsed;
                } else {
                    const parsedUtc = Date.parse(`${rawReleaseDate} UTC`);
                    if (!Number.isNaN(parsedUtc)) {
                        releaseTimestamp = parsedUtc;
                    }
                }
            }

            return {
                id: game.appid,
                name: details.name || game.name,
                slug: details.name ? details.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '',
                description: details.short_description || details.detailed_description || 'No description available',
                description_raw: details.detailed_description || details.short_description || 'No description available',
                released: releaseDisplay,
                releaseDate: releaseDisplay,
                releaseTimestamp,
                comingSoon,
                rating: details.metacritic ? (details.metacritic.score / 100) * 5 : null,
                ratingTop: 5,
                ratingsCount: details.recommendations ? details.recommendations.total : 0,
                metacritic: details.metacritic ? details.metacritic.score : null,
                playtime: null,
                platforms: details.platforms ? Object.keys(details.platforms)
                    .filter(key => details.platforms[key])
                    .map(key => ({
                        id: 0,
                        name: key.charAt(0).toUpperCase() + key.slice(1),
                        slug: key.toLowerCase()
                    })) : [],
                genres: details.genres ? details.genres.map(g => ({
                    id: g.id || 0,
                    name: g.description || 'Unknown',
                    slug: (g.description || 'unknown').toLowerCase().replace(/\s+/g, '-')
                })) : [],
                developers: details.developers ? details.developers.map((d, idx) => ({
                    id: idx,
                    name: d,
                    slug: d.toLowerCase().replace(/\s+/g, '-')
                })) : [],
                publishers: details.publishers ? details.publishers.map((p, idx) => ({
                    id: idx,
                    name: p,
                    slug: p.toLowerCase().replace(/\s+/g, '-')
                })) : [],
                backgroundImage: details.header_image || details.capsule_imagev5 || details.capsule_image || null,
                backgroundImageAdditional: null,
                website: details.website || null,
                screenshots: details.screenshots ? details.screenshots.map((s, idx) => ({
                    id: idx,
                    image: s.path_full || s.path_thumbnail || s.path_thumbnail
                })) : []
            };
        } else {
            // Basic format with minimal data from app list
            return {
                id: game.appid,
                name: game.name,
                slug: game.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                description: 'No description available',
                description_raw: 'No description available',
                released: 'TBA',
                releaseDate: 'TBA',
                releaseTimestamp: null,
                comingSoon: false,
                rating: null,
                ratingTop: 5,
                ratingsCount: 0,
                metacritic: null,
                playtime: null,
                platforms: [{ id: 0, name: 'PC', slug: 'pc' }],
                genres: [],
                developers: [],
                publishers: [],
                backgroundImage: null,
                backgroundImageAdditional: null,
                website: null,
                screenshots: []
            };
        }
    }



    // Remove games with similar titles to prevent duplicates
    removeSimilarTitles(games) {
        const uniqueGames = [];
        const seenTitles = new Set();
        
        for (const game of games) {
            if (!game.name) continue;
            
            // Normalize the title for comparison
            const normalizedTitle = game.name.toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove special characters
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .trim();
            
            // Check for similar titles (exact match or very similar)
            let isDuplicate = false;
            for (const seenTitle of seenTitles) {
                if (this.areTitlesSimilar(normalizedTitle, seenTitle)) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                uniqueGames.push(game);
                seenTitles.add(normalizedTitle);
            }
        }
        
        return uniqueGames;
    }

    // Check if two game titles are similar enough to be considered duplicates
    areTitlesSimilar(title1, title2) {
        // Exact match
        if (title1 === title2) return true;
        
        // Check for common patterns that indicate similar games
        const commonPatterns = [
            // Remove common suffixes/prefixes for comparison
            /:\s*(enhanced|definitive|complete|goty|game of the year|remastered|remake|edition|collection|bundle)$/i,
            /\(.*\)$/g, // Remove content in parentheses
            /\s*(the|a|an)\s+/gi, // Remove articles
            /\s+/g // Normalize spaces
        ];
        
        let cleanTitle1 = title1;
        let cleanTitle2 = title2;
        
        // Apply cleaning patterns
        for (const pattern of commonPatterns) {
            cleanTitle1 = cleanTitle1.replace(pattern, '').trim();
            cleanTitle2 = cleanTitle2.replace(pattern, '').trim();
        }
        
        // Check if cleaned titles are the same
        if (cleanTitle1 === cleanTitle2) return true;
        
        // Check for high similarity (80%+ match)
        const similarity = this.calculateSimilarity(cleanTitle1, cleanTitle2);
        return similarity > 0.8;
    }

    // Calculate string similarity using Levenshtein distance
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // Calculate Levenshtein distance between two strings
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    getMockSearchResults(query, page = 1, pageSize = 20) {

        const mockGames = [
            {
                id: 1,
                name: `Sample Game: ${query}`,
                slug: `sample-game-${query.toLowerCase().replace(/\s+/g, '-')}`,
                description_raw: `This is a sample game result for "${query}". The Steam API is being used for real game data. If you see this, the Steam app list may not be loaded yet.`,
                released: '2023-01-01',
                rating: 4.5,
                rating_top: 5,
                ratings_count: 100,
                metacritic: 85,
                playtime: 20,
                platforms: [
                    { id: 1, name: 'PC', slug: 'pc' },
                    { id: 2, name: 'PlayStation 5', slug: 'playstation5' },
                    { id: 3, name: 'Xbox Series X', slug: 'xbox-series-x' }
                ],
                genres: [
                    { id: 1, name: 'Action', slug: 'action' },
                    { id: 2, name: 'Adventure', slug: 'adventure' }
                ],
                developers: [
                    { id: 1, name: 'Sample Developer', slug: 'sample-developer' }
                ],
                publishers: [
                    { id: 1, name: 'Sample Publisher', slug: 'sample-publisher' }
                ],
                background_image: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rpf.jpg',
                short_screenshots: []
            },
            {
                id: 2,
                name: `Another Game: ${query}`,
                slug: `another-game-${query.toLowerCase().replace(/\s+/g, '-')}`,
                description_raw: `Another sample game result for "${query}". The search function uses Steam API for real game data.`,
                released: '2023-06-15',
                rating: 4.2,
                rating_top: 5,
                ratings_count: 75,
                metacritic: 78,
                playtime: 15,
                platforms: [
                    { id: 1, name: 'PC', slug: 'pc' },
                    { id: 4, name: 'Nintendo Switch', slug: 'nintendo-switch' }
                ],
                genres: [
                    { id: 3, name: 'RPG', slug: 'role-playing' },
                    { id: 4, name: 'Strategy', slug: 'strategy' }
                ],
                developers: [
                    { id: 2, name: 'Another Developer', slug: 'another-developer' }
                ],
                publishers: [
                    { id: 2, name: 'Another Publisher', slug: 'another-publisher' }
                ],
                background_image: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rpf.jpg',
                short_screenshots: []
            }
        ];

        // Format mock games using Steam format
        const formattedGames = mockGames.map(game => {
            const appInfo = { appid: game.id, name: game.name };
            return {
                id: game.id,
                name: game.name,
                slug: game.slug,
                description: game.description_raw || 'No description available',
                description_raw: game.description_raw || 'No description available',
                released: game.released,
                rating: game.rating,
                ratingTop: game.rating_top || 5,
                ratingsCount: game.ratings_count || 0,
                metacritic: game.metacritic,
                playtime: game.playtime,
                platforms: game.platforms || [],
                genres: game.genres || [],
                developers: game.developers || [],
                publishers: game.publishers || [],
                backgroundImage: game.background_image,
                backgroundImageAdditional: null,
                website: null,
                screenshots: []
            };
        });

        return {
            success: true,
            games: formattedGames,
            totalResults: mockGames.length,
            currentPage: page,
            totalPages: 1,
            isMockData: true
        };
    }

    async getGameDetails(gameId) {
        try {
            const parsedId = parseInt(gameId);
            if (isNaN(parsedId)) {
                console.error(`Invalid game ID: ${gameId}`);
                return {
                    success: false,
                    error: 'Invalid game ID',
                    game: null
                };
            }

            console.log(`[Game Details] Fetching Steam game details for app ID: ${parsedId}`);
            
            const details = await this.getSteamGameDetails(parsedId);
            
            if (details) {
                // Get basic app info to format properly
                const appInfo = { appid: parsedId, name: details.name || 'Unknown Game' };
                const gameData = this.formatSteamGameData(appInfo, details);
                console.log(`[Game Details] Successfully formatted game: ${gameData.name}`);
                return {
                    success: true,
                    game: gameData
                };
            } else {
                // Fallback to mock data
                console.log(`[Game Details] Game details not found for ${parsedId}, using mock data`);
                return this.getMockGameDetails(parsedId);
            }
        } catch (error) {
            console.error('[Game Details] Error fetching Steam game details:', error);
            console.error('[Game Details] Error stack:', error.stack);
            // Return error instead of mock data so frontend knows something went wrong
            return {
                success: false,
                error: `Failed to fetch game details: ${error.message}`,
                game: null
            };
        }
    }

    getMockGameDetails(gameId) {
        // Mock game details for demonstration
        const appInfo = { appid: parseInt(gameId), name: `Sample Game ${gameId}` };
        const mockDetails = {
            name: `Sample Game ${gameId}`,
            short_description: `This is sample game data for game ID ${gameId}. Steam API is being used for real game information.`,
            detailed_description: `This is sample game data for game ID ${gameId}. The Steam Store API provides detailed information about games.`,
            release_date: { date: '2023-01-01' },
            metacritic: { score: 85 },
            recommendations: { total: 100 },
            platforms: { windows: true, mac: false, linux: false },
            genres: [
                { id: 1, description: 'Action' },
                { id: 2, description: 'Adventure' }
            ],
            developers: ['Sample Developer'],
            publishers: ['Sample Publisher'],
            header_image: '/images/gamevault-logo.png',
            website: 'https://example.com',
            screenshots: []
        };

        return {
            success: true,
            game: this.formatSteamGameData(appInfo, mockDetails)
        };
    }

    formatGameData(game) {
        return {
            id: game.id,
            name: game.name,
            slug: game.slug,
            description: game.description_raw || game.description || 'No description available',
            released: game.released,
            rating: game.rating,
            ratingTop: game.rating_top,
            ratingsCount: game.ratings_count,
            metacritic: game.metacritic,
            playtime: game.playtime,
            platforms: game.platforms ? game.platforms.map(p => ({
                id: p.id,
                name: p.name,
                slug: p.slug
            })) : [],
            genres: game.genres ? game.genres.map(g => ({
                id: g ? g.id : 0,
                name: g ? g.name : 'Unknown',
                slug: g ? g.slug : 'unknown'
            })) : [],
            developers: game.developers ? game.developers.map(d => ({
                id: d ? d.id : 0,
                name: d ? d.name : 'Unknown',
                slug: d ? d.slug : 'unknown'
            })) : [],
            publishers: game.publishers ? game.publishers.map(p => ({
                id: p ? p.id : 0,
                name: p ? p.name : 'Unknown',
                slug: p ? p.slug : 'unknown'
            })) : [],
            backgroundImage: game.background_image,
            backgroundImageAdditional: game.background_image_additional,
            website: game.website,
            redditUrl: game.reddit_url,
            redditName: game.reddit_name,
            redditDescription: game.reddit_description,
            redditLogo: game.reddit_logo,
            screenshots: game.short_screenshots ? game.short_screenshots.map(s => ({
                id: s.id,
                image: s.image
            })) : [],
            esrbRating: game.esrb_rating ? {
                id: game.esrb_rating.id,
                name: game.esrb_rating.name,
                slug: game.esrb_rating.slug
            } : null,
            stores: game.stores ? game.stores.map(s => ({
                id: s.store.id,
                name: s.store.name,
                slug: s.store.slug,
                domain: s.store.domain,
                gamesCount: s.store.games_count,
                imageBackground: s.store.image_background
            })) : []
        };
    }

    // Get current player count for a Steam game
    async getCurrentPlayerCount(appId) {
        try {
            const response = await axios.get(`${this.steamApiBase}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/`, {
                params: {
                    appid: appId
                },
                timeout: 5000
            });
            
            if (response.data && response.data.response && response.data.response.result === 1) {
                return response.data.response.player_count || 0;
            }
            return 0;
        } catch (error) {
            // Silently fail - not all games have player count data
            return 0;
        }
    }

    // Enhanced getTrendingGames method for GameSearchService.js
    // Replace the existing getTrendingGames method with this improved version

    async getTrendingGames(limit = 8) {
        try {
            console.log(`🔍 [Trending] Fetching trending games from Steam...`);
            
            // Check if Steam API is blocked - use fallback
            if (this.steamApiBlocked) {
                console.log('⚠️ [Trending] Steam API blocked, using curated list');
                return this.getCuratedTrendingGames(limit);
            }
            
            // Strategy: Use a curated list of known popular game app IDs
            // These are consistently popular games that will have good data
            const popularGameIds = [
                // Top competitive/multiplayer games
                730,    // Counter-Strike 2
                570,    // Dota 2
                1172470, // Apex Legends
                1938090, // Call of Duty: Modern Warfare III
                271590,  // Grand Theft Auto V
                252490,  // Rust
                578080,  // PUBG: BATTLEGROUNDS
                
                // Popular single-player games
                1245620, // Elden Ring
                2358720, // Black Myth: Wukong
                1091500, // Cyberpunk 2077
                1174180, // Red Dead Redemption 2
                292030,  // The Witcher 3
                
                // Recent popular releases
                2050650, // Elden Ring DLC
                1817070, // Marvel's Spider-Man Remastered
                1144200, // Ready or Not
                
                // Consistently popular games
                381210,  // Dead by Daylight
                322330,  // Don't Starve Together
                601150,  // Devil May Cry 5
                814380,  // Sekiro
                
                // More variety
                1086940, // Baldur's Gate 3
                1506830, // The First Descendant
                1966720, // Starfield
                1203220, // Naraka: Bladepoint
                
                // Additional popular titles
                1449850, // Yu-Gi-Oh! Master Duel
                1551360, // Forza Horizon 5
                1919590, // Palworld
                2399830, // Helldivers 2
            ];
            
            // Shuffle the list for variety each time
            const shuffledIds = [...popularGameIds].sort(() => Math.random() - 0.5);
            
            // Fetch details for games in batches
            const batchSize = 3;
            const delayBetweenRequests = 400;
            const delayBetweenBatches = 1500;
            const gamesWithDetails = [];
            
            // Try to get more games than needed to filter for best ones
            const targetGames = Math.min(limit * 4, shuffledIds.length);
            
            for (let i = 0; i < targetGames; i += batchSize) {
                // Check circuit breaker
                if (this.steamApiBlocked) {
                    console.log('⚠️ [Trending] Steam API blocked during fetch, using curated list');
                    break;
                }
                
                const batch = shuffledIds.slice(i, i + batchSize);
                
                // Process batch sequentially with delays
                for (const appId of batch) {
                    try {
                        const details = await this.getSteamGameDetails(appId);
                        if (details) {
                            const formattedGame = this.formatSteamGameData(
                                { appid: appId, name: details.name || 'Unknown' },
                                details
                            );
                            
                            // Only include if it has good data
                            if (formattedGame.name && formattedGame.name !== 'Unknown') {
                                gamesWithDetails.push(formattedGame);
                                // Reset error counter on success
                                this.consecutive403Errors = 0;
                            }
                        }
                        
                        // Delay between requests
                        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
                    } catch (error) {
                        console.error(`Error fetching details for app ${appId}:`, error.message);
                    }
                }
                
                // Stop if we have enough games
                if (gamesWithDetails.length >= limit * 2) break;
                
                // Delay between batches
                if (i + batchSize < targetGames) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                }
            }

            console.log(`📊 [Trending] Fetched details for ${gamesWithDetails.length} games`);

            // Filter for games with good ratings/scores
            const gamesWithRatings = gamesWithDetails.filter(g => {
                if (!g) return false;
                const hasMetacritic = g.metacritic !== null && g.metacritic !== undefined && g.metacritic > 0;
                const hasRating = g.rating !== null && g.rating !== undefined && g.rating > 0;
                return (hasMetacritic || hasRating);
            });

            // Use games with ratings if we have enough, otherwise use all
            const gamesToSort = gamesWithRatings.length >= limit ? gamesWithRatings : gamesWithDetails;

            // Sort by quality score (metacritic + rating)
            gamesToSort.sort((a, b) => {
                const scoreA = (a.metacritic || 0) * 10 + (a.rating || 0) * 2;
                const scoreB = (b.metacritic || 0) * 10 + (b.rating || 0) * 2;
                return scoreB - scoreA;
            });

            const topGames = gamesToSort.slice(0, limit);
            
            // If we still don't have enough, use curated list
            if (topGames.length < limit) {
                console.log(`⚠️ [Trending] Only found ${topGames.length} games, using curated list`);
                return this.getCuratedTrendingGames(limit);
            }

            console.log(`✅ [Trending] Returning ${topGames.length} trending games`);

            return {
                success: true,
                games: topGames
            };
        } catch (error) {
            console.error(`❌ [Trending] Error:`, error.message);
            return this.getCuratedTrendingGames(limit);
        }
    }

    // Get popular/highest-rated games from Steam
    async getPopularGamesFallback(limit = 8) {
        try {
            console.log(`🔍 [Trending] Fetching highest-rated recent games from Steam...`);
            
            const appList = await this.getSteamAppList();
            
            if (!appList || appList.length === 0) {
                console.log('⚠️ [Trending] No Steam app list available, using mock data');
                return this.getMockTrendingGames(limit);
            }

            const combinedMap = new Map();
            const addGame = (game) => {
                if (!game || !game.appid) return;
                if (!combinedMap.has(game.appid)) {
                    combinedMap.set(game.appid, game);
                }
            };

            const topSliceSize = Math.min(2000, appList.length);
            appList.slice(0, topSliceSize).forEach(addGame);

            const recentWindowSize = Math.min(5000, appList.length);
            const recentPool = appList.slice(appList.length - recentWindowSize);
            const recentSampleSize = Math.min(recentPool.length, Math.max(limit * 25, 200));
            this.getRandomSample(recentPool, recentSampleSize).forEach(addGame);

            let sampleGames = Array.from(combinedMap.values());
            if (sampleGames.length === 0) {
                sampleGames = recentPool.slice(-Math.min(200, recentPool.length));
            }

            sampleGames.sort((a, b) => (b.appid || 0) - (a.appid || 0));

            const batchSize = 10;
            const gamesWithDetails = [];
            const targetGames = Math.min(sampleGames.length, Math.max(limit * 15, batchSize));
            
            for (let i = 0; i < targetGames; i += batchSize) {
                const batch = sampleGames.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (game) => {
                        try {
                            const details = await this.getSteamGameDetails(game.appid);
                            if (details) {
                                return this.formatSteamGameData(game, details);
                            }
                            return null;
                        } catch (error) {
                            return null;
                        }
                    })
                );
                
                gamesWithDetails.push(...batchResults.filter(g => g !== null));
                
                if (i + batchSize < targetGames) {
                    await new Promise(resolve => setTimeout(resolve, 400));
                }

                if (gamesWithDetails.length >= limit * 6) {
                    break;
                }
            }

            if (gamesWithDetails.length === 0) {
                console.log('⚠️ [Trending] No fallback games found, using mock data');
                return this.getMockTrendingGames(limit);
            }

            let candidatePool = this.filterRecentGames(gamesWithDetails, [6, 12, 18], limit);
            if (candidatePool.length === 0) {
                candidatePool = gamesWithDetails;
            }

            let ratedGames = candidatePool.filter(g => {
                if (!g) return false;
                const hasMetacritic = g.metacritic !== null && g.metacritic !== undefined && g.metacritic > 0;
                const hasRating = g.rating !== null && g.rating !== undefined && g.rating > 0;
                return hasMetacritic || hasRating;
            });

            if (ratedGames.length < limit && candidatePool.length > ratedGames.length) {
                const remainder = candidatePool.filter(g => g && !ratedGames.includes(g));
                ratedGames = ratedGames.concat(remainder);
            }

            ratedGames.sort((a, b) => this.compareByRecencyPopularity(a, b));

            let topGames = ratedGames.slice(0, limit);
            const seenIds = new Set(topGames.map(g => g ? (g.id || g.appid) : null).filter(Boolean));

            const fillFromPool = (pool) => {
                if (!pool || pool.length === 0 || topGames.length >= limit) {
                    return;
                }
                const sortedPool = [...pool].sort((a, b) => this.compareByRecencyPopularity(a, b));
                for (const game of sortedPool) {
                    if (!game) continue;
                    const id = game.id || game.appid;
                    if (!id || seenIds.has(id)) continue;
                    topGames.push(game);
                    seenIds.add(id);
                    if (topGames.length >= limit) break;
                }
            };

            if (topGames.length < limit) {
                const remainderCandidate = candidatePool.filter(g => g && !seenIds.has(g.id || g.appid));
                fillFromPool(remainderCandidate);
            }

            if (topGames.length < limit) {
                const remainderAll = gamesWithDetails.filter(g => g && !seenIds.has(g.id || g.appid));
                fillFromPool(remainderAll);
            }

            if (topGames.length < limit) {
                console.log(`⚠️ [Trending] Only found ${topGames.length} fallback games, using mock data for remaining ${limit - topGames.length} games`);
                const mockGames = this.getMockTrendingGames(limit - topGames.length);
                if (mockGames.games && mockGames.games.length > 0) {
                    for (const game of mockGames.games) {
                        const id = game.id || game.appid;
                        if (!id || seenIds.has(id)) continue;
                        topGames.push(game);
                        seenIds.add(id);
                        if (topGames.length >= limit) break;
                    }
                }
            }

            return {
                success: true,
                games: topGames.slice(0, limit)
            };
        } catch (error) {
            console.error('❌ [Trending] Error fetching trending games:', error.message);
            console.log('⚠️ [Trending] Using mock data as fallback');
            return this.getMockTrendingGames(limit);
        }
    }

    // Enhanced getRecentGames method - focuses on 2024-2025 releases only
    async getRecentGames(limit = 8) {
        try {
            console.log(`🔍 [Recent] Fetching recent games from Steam...`);
            
            // Check if Steam API is blocked
            if (this.steamApiBlocked) {
                console.log('⚠️ [Recent] Steam API blocked, using curated list');
                return this.getCuratedRecentGames(limit);
            }
            
            // Curated list of RECENT (2024-2025) popular releases only
            // These are games released in the last 12 months that were highly anticipated/popular
            const recentGameIds = [
                // 2024-2025 Major Releases
                2358720, // Black Myth: Wukong (Aug 2024)
                2399830, // Helldivers 2 (Feb 2024)
                1623730, // Palworld (Jan 2024)
                2369390, // Tekken 8 (Jan 2024)
                2161700, // Dragon's Dogma 2 (Mar 2024)
                2050650, // Elden Ring Shadow of the Erdtree (Jun 2024)
                2552430, // Indiana Jones and the Great Circle (Dec 2024)
                2379780, // Marvel's Spider-Man 2 (Nov 2024 - PC)
                2050650, // Elden Ring DLC (Jun 2024)
                1938090, // Call of Duty: Modern Warfare III (Nov 2023)
                2933120, // Hades II (May 2024 - Early Access)
                2239550, // Senua's Saga: Hellblade II (May 2024)
                2186680, // Prince of Persia: The Lost Crown (Jan 2024)
                2677660, // Last Epoch (Feb 2024)
                2302670, // The Outlast Trials (Mar 2024)
                1627720, // Baldur's Gate 3 (Aug 2023 - still very relevant)
            ];
            
            const shuffledIds = [...recentGameIds].sort(() => Math.random() - 0.5);
            
            // Fetch details with rate limiting
            const batchSize = 3;
            const gamesWithDetails = [];
            
            for (let i = 0; i < Math.min(shuffledIds.length, limit * 3); i += batchSize) {
                if (this.steamApiBlocked) break;
                
                const batch = shuffledIds.slice(i, i + batchSize);
                
                for (const appId of batch) {
                    try {
                        const details = await this.getSteamGameDetails(appId);
                        if (details) {
                            const formattedGame = this.formatSteamGameData(
                                { appid: appId, name: details.name || 'Unknown' },
                                details
                            );
                            if (formattedGame.name && formattedGame.name !== 'Unknown') {
                                gamesWithDetails.push(formattedGame);
                            }
                        }
                        await new Promise(resolve => setTimeout(resolve, 400));
                    } catch (error) {
                        console.error(`Error fetching details for app ${appId}:`, error.message);
                    }
                }
                
                if (gamesWithDetails.length >= limit * 2) break;
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // Sort by release date (newest first) and quality
            gamesWithDetails.sort((a, b) => {
                const dateA = new Date(a.released || '2020-01-01');
                const dateB = new Date(b.released || '2020-01-01');
                return dateB - dateA;
            });

            const recentGames = gamesWithDetails.slice(0, limit);
            
            if (recentGames.length < limit) {
                return this.getCuratedRecentGames(limit);
            }

            return {
                success: true,
                games: recentGames
            };
        } catch (error) {
            console.error(`❌ [Recent] Error:`, error.message);
            return this.getCuratedRecentGames(limit);
        }
    }

    // Get search suggestions for autocomplete
    async getSearchSuggestions(query, limit = 5) {
        try {
            // Get Steam app list (cached)
            const appList = await this.getSteamAppList();
            
            if (!appList || appList.length === 0) {
                return {
                    success: true,
                    suggestions: []
                };
            }

            // Search locally through the app list
            const searchQuery = query.toLowerCase().trim();
            const matchingGames = appList.filter(game => 
                game.name && game.name.toLowerCase().includes(searchQuery)
            ).slice(0, limit * 2); // Get more to filter for best matches

            // Sort by relevance
            matchingGames.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aExact = aName === searchQuery || aName.startsWith(searchQuery);
                const bExact = bName === searchQuery || bName.startsWith(searchQuery);
                
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return aName.localeCompare(bName);
            });

            // Format suggestions
            const suggestions = matchingGames.slice(0, limit).map(game => ({
                name: game.name,
                released: null, // Steam app list doesn't have release dates
                rating: null,
                cover: null
            }));

            return {
                success: true,
                suggestions: suggestions
            };
        } catch (error) {
            console.error('Error fetching search suggestions:', error);
            return {
                success: true,
                suggestions: []
            };
        }
    }

    // Mock trending games data
    getMockTrendingGames(limit) {
            const mockTrendingGames = [
                {
                    id: 1,
                    name: "The Witcher 3: Wild Hunt",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
                    description_raw: "The Witcher 3: Wild Hunt is a story-driven, next-generation open world RPG set in a fantasy universe full of meaningful choices and impactful consequences.",
                    released: "2015-05-19",
                    rating: 9.2,
                    platforms: [{ name: "PC" }, { name: "PlayStation 4" }, { name: "Xbox One" }],
                    genres: [{ name: "RPG" }, { name: "Action" }]
                },
                {
                    id: 2,
                    name: "Cyberpunk 2077",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co7iy1.jpg",
                    description_raw: "Cyberpunk 2077 is an open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and ceaseless body modification.",
                    released: "2020-12-10",
                    rating: 8.5,
                    platforms: [{ name: "PC" }, { name: "PlayStation 4" }, { name: "Xbox One" }],
                    genres: [{ name: "RPG" }, { name: "Action" }]
                },
                {
                    id: 3,
                    name: "Elden Ring",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
                    description_raw: "Elden Ring is a fantasy action-RPG adventure set within a world created by Hidetaka Miyazaki and George R. R. Martin.",
                    released: "2022-02-25",
                    rating: 9.5,
                    platforms: [{ name: "PC" }, { name: "PlayStation 5" }, { name: "Xbox Series X" }],
                    genres: [{ name: "RPG" }, { name: "Action" }]
                },
                {
                    id: 4,
                    name: "God of War",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg",
                    description_raw: "His vengeance against the Gods of Olympus years behind him, Kratos now lives as a man in the realm of Norse Gods and monsters.",
                    released: "2018-04-20",
                    rating: 9.4,
                    platforms: [{ name: "PlayStation 4" }, { name: "PC" }],
                    genres: [{ name: "Action" }, { name: "Adventure" }]
                },
                {
                    id: 5,
                    name: "Red Dead Redemption 2",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1q1f.jpg",
                    description_raw: "Red Dead Redemption 2 is a story of outlaw Arthur Morgan and the Van der Linde gang as they rob, fight and steal their way across the vast and unforgiving heart of America.",
                    released: "2018-10-26",
                    rating: 9.3,
                    platforms: [{ name: "PC" }, { name: "PlayStation 4" }, { name: "Xbox One" }],
                    genres: [{ name: "Action" }, { name: "Adventure" }]
                },
                {
                    id: 6,
                    name: "The Last of Us Part II",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5ziw.jpg",
                    description_raw: "The Last of Us Part II is a story-driven action-adventure game that follows Ellie's journey through a post-apocalyptic world.",
                    released: "2020-06-19",
                    rating: 9.1,
                    platforms: [{ name: "PlayStation 4" }, { name: "PlayStation 5" }],
                    genres: [{ name: "Action" }, { name: "Adventure" }]
                },
                {
                    id: 7,
                    name: "Ghost of Tsushima",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2crj.jpg",
                    description_raw: "Ghost of Tsushima is an open-world action-adventure game set in feudal Japan during the Mongol invasion.",
                    released: "2020-07-17",
                    rating: 8.9,
                    platforms: [{ name: "PlayStation 4" }, { name: "PlayStation 5" }],
                    genres: [{ name: "Action" }, { name: "Adventure" }]
                },
                {
                    id: 8,
                    name: "Horizon Zero Dawn",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2una.jpg",
                    description_raw: "Horizon Zero Dawn is an action role-playing game set in a post-apocalyptic world where robotic creatures dominate the land.",
                    released: "2017-02-28",
                    rating: 8.8,
                    platforms: [{ name: "PC" }, { name: "PlayStation 4" }],
                    genres: [{ name: "RPG" }, { name: "Action" }]
                }
            ];

        return {
            success: true,
            games: mockTrendingGames.slice(0, limit),
            totalResults: mockTrendingGames.length
        };
    }


    // Get mock trending games with correct, known working image URLs
    getMockTrendingGamesWithCorrectImages(limit = 8) {
        const mockTrendingGames = [
            {
                id: 1,
                name: "The Witcher 3: Wild Hunt",
                background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
                description_raw: "The Witcher 3: Wild Hunt is a story-driven, next-generation open world RPG set in a fantasy universe full of meaningful choices and impactful consequences.",
                released: "2015-05-19",
                rating: 9.2,
                platforms: [{ name: "PC" }, { name: "PlayStation 4" }, { name: "Xbox One" }],
                genres: [{ name: "RPG" }, { name: "Action" }]
            },
            {
                id: 2,
                name: "Cyberpunk 2077",
                background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co7iy1.jpg",
                description_raw: "Cyberpunk 2077 is an open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and ceaseless body modification.",
                released: "2020-12-10",
                rating: 8.5,
                platforms: [{ name: "PC" }, { name: "PlayStation 4" }, { name: "Xbox One" }],
                genres: [{ name: "RPG" }, { name: "Action" }]
            },
            {
                id: 3,
                name: "Elden Ring",
                background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
                description_raw: "Elden Ring is a fantasy action-RPG adventure set within a world created by Hidetaka Miyazaki and George R. R. Martin.",
                released: "2022-02-25",
                rating: 9.5,
                platforms: [{ name: "PC" }, { name: "PlayStation 5" }, { name: "Xbox Series X" }],
                genres: [{ name: "RPG" }, { name: "Action" }]
            },
            {
                id: 4,
                name: "God of War",
                background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg",
                description_raw: "His vengeance against the Gods of Olympus years behind him, Kratos now lives as a man in the realm of Norse Gods and monsters.",
                released: "2018-04-20",
                rating: 9.4,
                platforms: [{ name: "PlayStation 4" }, { name: "PC" }],
                genres: [{ name: "Action" }, { name: "Adventure" }]
            },
            {
                id: 5,
                name: "Red Dead Redemption 2",
                background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1q1f.jpg",
                description_raw: "Red Dead Redemption 2 is a story of outlaw Arthur Morgan and the Van der Linde gang as they rob, fight and steal their way across the vast and unforgiving heart of America.",
                released: "2018-10-26",
                rating: 9.3,
                platforms: [{ name: "PC" }, { name: "PlayStation 4" }, { name: "Xbox One" }],
                genres: [{ name: "Action" }, { name: "Adventure" }]
            },
            {
                id: 6,
                name: "The Last of Us Part II",
                background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5ziw.jpg",
                description_raw: "The Last of Us Part II is a story-driven action-adventure game that follows Ellie's journey through a post-apocalyptic world.",
                released: "2020-06-19",
                rating: 9.1,
                platforms: [{ name: "PlayStation 4" }, { name: "PlayStation 5" }],
                genres: [{ name: "Action" }, { name: "Adventure" }]
            },
            {
                id: 7,
                name: "Ghost of Tsushima",
                background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2crj.jpg",
                description_raw: "Ghost of Tsushima is an open-world action-adventure game set in feudal Japan during the Mongol invasion.",
                released: "2020-07-17",
                rating: 8.9,
                platforms: [{ name: "PlayStation 4" }, { name: "PlayStation 5" }],
                genres: [{ name: "Action" }, { name: "Adventure" }]
            },
            {
                id: 8,
                name: "Horizon Zero Dawn",
                background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2una.jpg",
                description_raw: "Horizon Zero Dawn is an action role-playing game set in a post-apocalyptic world where robotic creatures dominate the land.",
                released: "2017-02-28",
                rating: 8.8,
                platforms: [{ name: "PC" }, { name: "PlayStation 4" }],
                genres: [{ name: "RPG" }, { name: "Action" }]
            }
        ];

        return {
            success: true,
            games: mockTrendingGames.slice(0, limit),
            totalResults: mockTrendingGames.length
        };
    }

    // Mock recent games data
    getMockRecentGames(limit) {
            const mockRecentGames = [
                {
                    id: 9,
                    name: "Hogwarts Legacy",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaav6.jpg",
                    description_raw: "Hogwarts Legacy is an immersive, open-world action RPG set in the world first introduced in the Harry Potter books.",
                    released: "2023-02-10",
                    rating: 8.7,
                    platforms: [{ name: "PC" }, { name: "PlayStation 5" }, { name: "Xbox Series X" }],
                    genres: [{ name: "RPG" }, { name: "Action" }]
                },
                {
                    id: 10,
                    name: "Starfield",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co39vv.jpg",
                    description_raw: "Starfield is the first new universe in over 25 years from Bethesda Game Studios, the award-winning creators of The Elder Scrolls and Fallout series.",
                    released: "2023-09-06",
                    rating: 8.2,
                    platforms: [{ name: "PC" }, { name: "Xbox Series X" }],
                    genres: [{ name: "RPG" }, { name: "Sci-Fi" }]
                },
                {
                    id: 11,
                    name: "Baldur's Gate 3",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co670h.jpg",
                    description_raw: "Baldur's Gate 3 is a story-rich, party-based RPG set in the universe of Dungeons & Dragons, where your choices shape a tale of fellowship and betrayal.",
                    released: "2023-08-03",
                    rating: 9.6,
                    platforms: [{ name: "PC" }, { name: "PlayStation 5" }],
                    genres: [{ name: "RPG" }, { name: "Strategy" }]
                },
                {
                    id: 12,
                    name: "Spider-Man 2",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2nc6.jpg",
                    description_raw: "Spider-Man 2 is an action-adventure game featuring both Peter Parker and Miles Morales as playable characters.",
                    released: "2023-10-20",
                    rating: 9.1,
                    platforms: [{ name: "PlayStation 5" }],
                    genres: [{ name: "Action" }, { name: "Adventure" }]
                },
                {
                    id: 13,
                    name: "Alan Wake 2",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co6jar.jpg",
                    description_raw: "Alan Wake 2 is a survival horror game that follows the story of Alan Wake, a writer trapped in a nightmare.",
                    released: "2023-10-27",
                    rating: 8.8,
                    platforms: [{ name: "PC" }, { name: "PlayStation 5" }, { name: "Xbox Series X" }],
                    genres: [{ name: "Horror" }, { name: "Action" }]
                },
                {
                    id: 14,
                    name: "Final Fantasy XVI",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5w3k.jpg",
                    description_raw: "Final Fantasy XVI is an action role-playing game set in the fantasy world of Valisthea, where six nations fight for control of magical Crystals.",
                    released: "2023-06-22",
                    rating: 8.5,
                    platforms: [{ name: "PlayStation 5" }, { name: "PC" }],
                    genres: [{ name: "RPG" }, { name: "Action" }]
                },
                {
                    id: 15,
                    name: "Diablo IV",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co69sm.jpg",
                    description_raw: "Diablo IV is an action role-playing game where players battle demons and collect loot in the dark fantasy world of Sanctuary.",
                    released: "2023-06-06",
                    rating: 8.3,
                    platforms: [{ name: "PC" }, { name: "PlayStation 4" }, { name: "Xbox One" }],
                    genres: [{ name: "RPG" }, { name: "Action" }]
                },
                {
                    id: 16,
                    name: "Resident Evil 4 Remake",
                    background_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2wn5.jpg",
                    description_raw: "Resident Evil 4 Remake is a survival horror game that reimagines the classic 2005 game with modern graphics and gameplay.",
                    released: "2023-03-24",
                    rating: 9.0,
                    platforms: [{ name: "PC" }, { name: "PlayStation 4" }, { name: "Xbox One" }],
                    genres: [{ name: "Horror" }, { name: "Action" }]
                }
            ];

        return {
            success: true,
            games: mockRecentGames.slice(0, limit),
            totalResults: mockRecentGames.length
        };
    }

    getRandomSample(array, size) {
        if (!Array.isArray(array) || array.length === 0 || size <= 0) {
            return [];
        }
        const sample = array.slice();
        const maxIndex = sample.length - 1;
        for (let i = maxIndex; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sample[i], sample[j]] = [sample[j], sample[i]];
        }
        return sample.slice(0, Math.min(size, sample.length));
    }

    getMonthsAgoTimestamp(months) {
        const date = new Date();
        date.setMonth(date.getMonth() - months);
        return date.getTime();
    }

    filterRecentGames(games, monthWindows = [6, 12], minimum = 0) {
        if (!Array.isArray(games) || games.length === 0) {
            return [];
        }

        for (const months of monthWindows) {
            const threshold = this.getMonthsAgoTimestamp(months);
            const filtered = games.filter(game => {
                if (!game) return false;
                if (game.comingSoon) return false;
                if (!game.releaseTimestamp) return false;
                return game.releaseTimestamp >= threshold;
            });
            if (filtered.length >= Math.max(minimum, 1)) {
                return filtered;
            }
        }

        return games.filter(game => game && game.releaseTimestamp && !game.comingSoon);
    }

    compareByRecencyPopularity(a, b) {
        const releaseDiff = (b?.releaseTimestamp || 0) - (a?.releaseTimestamp || 0);
        if (releaseDiff !== 0) {
            return releaseDiff;
        }

        const playerDiff = (b?.currentPlayers || 0) - (a?.currentPlayers || 0);
        if (playerDiff !== 0) {
            return playerDiff;
        }

        const scoreA = (a?.metacritic || 0) * 10 + (a?.rating || 0) * 3 + Math.min(a?.ratingsCount || 0, 50000) / 1000;
        const scoreB = (b?.metacritic || 0) * 10 + (b?.rating || 0) * 3 + Math.min(b?.ratingsCount || 0, 50000) / 1000;
        return scoreB - scoreA;
    }

    getCuratedRecentGames(limit = 8) {
        const recentGames = [
            {
                id: 2399830,
                name: "Helldivers 2",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2399830/header.jpg",
                description: "The Galaxy's Last Line of Offence. Enlist in the Helldivers and join the fight for freedom across a hostile galaxy in a fast, frantic, and ferocious third-person shooter.",
                released: "2024-02-08",
                rating: 4.7,
                metacritic: 82,
                platforms: [{ name: "PC" }, { name: "PlayStation" }],
                genres: [{ name: "Action" }, { name: "Shooter" }]
            },
            {
                id: 2358720,
                name: "Black Myth: Wukong",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/header.jpg",
                description: "Black Myth: Wukong is an action RPG rooted in Chinese mythology. You shall set out as the Destined One to venture into the challenges and marvels ahead, to uncover the obscured truth beneath the veil of a glorious legend from the past.",
                released: "2024-08-20",
                rating: 4.8,
                metacritic: 82,
                platforms: [{ name: "PC" }, { name: "PlayStation" }],
                genres: [{ name: "Action" }, { name: "RPG" }]
            },
            {
                id: 1623730,
                name: "Palworld",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1623730/header.jpg",
                description: "Fight, farm, build and work alongside mysterious creatures called 'Pals' in this completely new multiplayer, open-world survival and crafting game!",
                released: "2024-01-19",
                rating: 4.5,
                metacritic: 75,
                platforms: [{ name: "PC" }, { name: "Xbox" }],
                genres: [{ name: "Survival" }, { name: "Adventure" }]
            },
            {
                id: 2369390,
                name: "Tekken 8",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2369390/header.jpg",
                description: "Get ready for the next chapter in the legendary fighting game franchise, Tekken 8.",
                released: "2024-01-26",
                rating: 4.6,
                metacritic: 90,
                platforms: [{ name: "PC" }, { name: "PlayStation" }, { name: "Xbox" }],
                genres: [{ name: "Fighting" }, { name: "Action" }]
            },
            {
                id: 1966720,
                name: "Starfield",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1966720/header.jpg",
                description: "Starfield is the first new universe in 25 years from Bethesda Game Studios, the award-winning creators of The Elder Scrolls V: Skyrim and Fallout 4.",
                released: "2023-09-06",
                rating: 4.2,
                metacritic: 83,
                platforms: [{ name: "PC" }, { name: "Xbox" }],
                genres: [{ name: "RPG" }, { name: "Sci-Fi" }]
            },
            {
                id: 1817070,
                name: "Marvel's Spider-Man Remastered",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1817070/header.jpg",
                description: "In Marvel's Spider-Man Remastered, the worlds of Peter Parker and Spider-Man collide in an original action-packed story.",
                released: "2022-08-12",
                rating: 4.8,
                metacritic: 87,
                platforms: [{ name: "PC" }, { name: "PlayStation" }],
                genres: [{ name: "Action" }, { name: "Adventure" }]
            },
            {
                id: 2161700,
                name: "Dragon's Dogma 2",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2161700/header.jpg",
                description: "Dragon's Dogma 2 is a single player, narrative driven action-RPG that challenges the players to choose their own experience – from the appearance of their Arisen, their vocation, their party, how to approach different situations and more.",
                released: "2024-03-22",
                rating: 4.3,
                metacritic: 86,
                platforms: [{ name: "PC" }, { name: "PlayStation" }, { name: "Xbox" }],
                genres: [{ name: "RPG" }, { name: "Action" }]
            }
        ];

        return {
            success: true,
            games: recentGames.slice(0, limit).map(game => ({
                id: game.id,
                name: game.name,
                slug: game.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                description: game.description,
                description_raw: game.description,
                released: game.released,
                rating: game.rating,
                ratingTop: 5,
                ratingsCount: 1000,
                metacritic: game.metacritic,
                playtime: null,
                platforms: game.platforms,
                genres: game.genres,
                developers: [],
                publishers: [],
                backgroundImage: game.backgroundImage,
                backgroundImageAdditional: null,
                website: null,
                screenshots: []
            }))
        };
    }

    // Add this new method to provide curated trending games as fallback
    getCuratedTrendingGames(limit = 8) {
        // Curated list of consistently popular games with verified data
        const curatedGames = [
            {
                id: 730,
                name: "Counter-Strike 2",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/header.jpg",
                description: "For over two decades, Counter-Strike has offered an elite competitive experience, one shaped by millions of players from across the globe. And now the next chapter in the CS story is about to begin. This is Counter-Strike 2.",
                released: "2023-09-27",
                rating: 4.5,
                metacritic: 87,
                platforms: [{ name: "PC" }],
                genres: [{ name: "Action" }, { name: "FPS" }]
            },
            {
                id: 1245620,
                name: "Elden Ring",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg",
                description: "THE NEW FANTASY ACTION RPG. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.",
                released: "2022-02-25",
                rating: 4.8,
                metacritic: 96,
                platforms: [{ name: "PC" }, { name: "PlayStation" }, { name: "Xbox" }],
                genres: [{ name: "RPG" }, { name: "Action" }]
            },
            {
                id: 1086940,
                name: "Baldur's Gate 3",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/header.jpg",
                description: "Gather your party and return to the Forgotten Realms in a tale of fellowship and betrayal, sacrifice and survival, and the lure of absolute power.",
                released: "2023-08-03",
                rating: 4.9,
                metacritic: 96,
                platforms: [{ name: "PC" }, { name: "PlayStation" }],
                genres: [{ name: "RPG" }, { name: "Strategy" }]
            },
            {
                id: 271590,
                name: "Grand Theft Auto V",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg",
                description: "Grand Theft Auto V for PC offers players the option to explore the award-winning world of Los Santos and Blaine County in resolutions of up to 4k and beyond, as well as the chance to experience the game running at 60 frames per second.",
                released: "2015-04-14",
                rating: 4.7,
                metacritic: 96,
                platforms: [{ name: "PC" }, { name: "PlayStation" }, { name: "Xbox" }],
                genres: [{ name: "Action" }, { name: "Adventure" }]
            },
            {
                id: 1091500,
                name: "Cyberpunk 2077",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg",
                description: "Cyberpunk 2077 is an open-world, action-adventure RPG set in the dark future of Night City — a dangerous megalopolis obsessed with power, glamor, and ceaseless body modification.",
                released: "2020-12-10",
                rating: 4.3,
                metacritic: 86,
                platforms: [{ name: "PC" }, { name: "PlayStation" }, { name: "Xbox" }],
                genres: [{ name: "RPG" }, { name: "Action" }]
            },
            {
                id: 1174180,
                name: "Red Dead Redemption 2",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/header.jpg",
                description: "Winner of over 175 Game of the Year Awards and recipient of over 250 perfect scores, RDR2 is the epic tale of outlaw Arthur Morgan and the infamous Van der Linde gang, on the run across America at the dawn of the modern age.",
                released: "2019-11-05",
                rating: 4.8,
                metacritic: 97,
                platforms: [{ name: "PC" }, { name: "PlayStation" }, { name: "Xbox" }],
                genres: [{ name: "Action" }, { name: "Adventure" }]
            },
            {
                id: 570,
                name: "Dota 2",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/header.jpg",
                description: "Every day, millions of players worldwide enter battle as one of over a hundred Dota heroes. And no matter if it's their 10th hour of play or 1,000th, there's always something new to discover.",
                released: "2013-07-09",
                rating: 4.4,
                metacritic: 90,
                platforms: [{ name: "PC" }],
                genres: [{ name: "MOBA" }, { name: "Strategy" }]
            },
            {
                id: 292030,
                name: "The Witcher 3: Wild Hunt",
                backgroundImage: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/header.jpg",
                description: "As war rages on throughout the Northern Realms, you take on the greatest contract of your life — tracking down the Child of Prophecy, a living weapon that can alter the shape of the world.",
                released: "2015-05-18",
                rating: 4.9,
                metacritic: 93,
                platforms: [{ name: "PC" }, { name: "PlayStation" }, { name: "Xbox" }],
                genres: [{ name: "RPG" }, { name: "Action" }]
            }
        ];

        return {
            success: true,
            games: curatedGames.slice(0, limit).map(game => ({
                id: game.id,
                name: game.name,
                slug: game.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                description: game.description,
                description_raw: game.description,
                released: game.released,
                rating: game.rating,
                ratingTop: 5,
                ratingsCount: 1000,
                metacritic: game.metacritic,
                playtime: null,
                platforms: game.platforms,
                genres: game.genres,
                developers: [],
                publishers: [],
                backgroundImage: game.backgroundImage,
                backgroundImageAdditional: null,
                website: null,
                screenshots: []
            }))
        };
    }
}

module.exports = GameSearchService;


