const axios = require('axios');
const https = require('https');

class GameSearchService {
    constructor() {
        // Steam API configuration
        this.apiKey = process.env.STEAM_API_KEY;
        this.steamApiBase = 'https://api.steampowered.com';
        this.steamStoreBase = 'https://store.steampowered.com/api';
        // Cache for app list
        this.appListCache = null;
        this.appListCacheTime = null;
        this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours
    }

    async searchGames(query, page = 1, pageSize = 20) {
        try {
            console.log(`🔍 [Search] Searching Steam for: "${query}"`);
            
            // Get Steam app list (cached)
            let appList;
            try {
                appList = await this.getSteamAppList();
            } catch (error) {
                console.error(`❌ [Search] Failed to get Steam app list:`, error.message);
                appList = null;
            }
            
            if (!appList || appList.length === 0) {
                console.log(`⚠️ [Search] No Steam app list available (cache: ${this.appListCache ? this.appListCache.length : 0} games), using mock data`);
                console.log(`💡 [Search] Tip: Visit /api/games/test-steam to check Steam API status`);
                const mockResult = this.getMockSearchResults(query, page, pageSize);
                mockResult.isMockData = true;
                return mockResult;
            }

            console.log(`✅ [Search] Using Steam app list with ${appList.length} games`);

            // Search locally through the app list
            const searchQuery = query.toLowerCase().trim();
            const matchingGames = appList.filter(game => 
                game.name && game.name.toLowerCase().includes(searchQuery)
            );

            // Sort by relevance (exact matches first, then partial matches) - initial sort
            matchingGames.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aExact = aName === searchQuery || aName.startsWith(searchQuery);
                const bExact = bName === searchQuery || bName.startsWith(searchQuery);
                
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return aName.localeCompare(bName);
            });

            // Fetch details for more games than needed (to allow proper rating-based sorting)
            // Limit to first 100 matches to avoid performance issues
            const maxGamesToFetch = Math.min(100, matchingGames.length);
            const gamesToFetch = matchingGames.slice(0, maxGamesToFetch);

            // Get detailed information for games (in batches to avoid overwhelming the API)
            const batchSize = 10;
            const gamesWithDetails = [];
            
            for (let i = 0; i < gamesToFetch.length; i += batchSize) {
                const batch = gamesToFetch.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (game) => {
                        try {
                            const details = await this.getSteamGameDetails(game.appid);
                            const formattedGame = this.formatSteamGameData(game, details);
                            return formattedGame;
                        } catch (error) {
                            console.error(`Error fetching details for app ${game.appid}:`, error);
                            return null; // Skip games where we can't get details
                        }
                    })
                );
                gamesWithDetails.push(...batchResults);
            }

            // Filter out null games, games without ratings, DLCs, videos, and non-games
            let gamesWithRatings = gamesWithDetails.filter(g => {
                if (!g) return false;
                
                // Filter out DLCs, videos, trailers, demos, and non-games
                // Check game name for common indicators - be very strict
                const name = g.name ? g.name.toLowerCase().trim() : '';
                
                // More comprehensive DLC detection - but allow game editions (Enhanced, GOTY, etc.)
                // Only exclude actual DLC/expansion content, not full game editions
                const isDLC = name.includes('downloadable content') ||
                             name.includes('expansion pack') ||
                             name.includes('expansion:') ||
                             (name.includes(' - ') && name.split(' - ')[1].toLowerCase().includes('dlc')) ||
                             (name.includes(' - ') && (
                                name.split(' - ')[1].toLowerCase().includes('pack') && 
                                !name.split(' - ')[1].toLowerCase().includes('edition')
                             )) ||
                             name.includes('add-on') ||
                             name.includes('addon') ||
                             // DLC in name but only if it's clearly DLC, not part of game title
                             (name.includes('dlc') && (
                                name.endsWith(' dlc') ||
                                name.includes(' - dlc') ||
                                name.includes(' dlc -')
                             ));
                
                // Game editions are OK - these are full games
                // Don't filter: Enhanced Edition, GOTY Edition, Definitive Edition, Complete Edition, etc.
                
                // Video/Trailer detection
                const isVideo = name.includes('trailer') || 
                               name.includes('video') ||
                               name.includes('movie') ||
                               name.includes('film') ||
                               name.includes('cinematic') ||
                               g.id < 1000; // Steam uses low app IDs for non-game content
                
                // Demo detection - stricter
                const isDemo = name.includes('demo') || 
                             name.includes('demo ') ||
                             name.includes(' demo') ||
                             name.includes('trial');
                
                // Tool/Editor detection
                const isTool = name.includes('tool') || 
                              name.includes('editor') ||
                              name.includes('sdk') ||
                              name.includes('kit');
                
                // Soundtrack/OST detection
                const isSoundtrack = name.includes('soundtrack') || 
                                    name.includes('ost') ||
                                    name.includes('music') && (name.includes('album') || name.includes('collection'));
                
                // Asset/Content pack detection
                const isAssetPack = name.includes('assets') && name.includes('pack') ||
                                   name.includes('graphic assets') ||
                                   name.includes('texture pack') ||
                                   name.includes('content pack');
                
                // Hardware detection
                const isHardware = name.includes('hardware') || 
                                  name.includes('controller') ||
                                  name.includes('peripheral');
                
                // Switcher apps (often browser extensions, not games)
                const isSwitcherApp = name.includes('switcher') && (
                    name.includes('chrome') || 
                    name.includes('browser') ||
                    name.includes('extension')
                );
                
                // Only include actual games - reject if any non-game indicator found
                if (isDLC || isVideo || isTool || isDemo || isSoundtrack || isAssetPack || isHardware || isSwitcherApp) {
                    console.log(`🚫 [Filter] Excluding non-game: "${g.name}" (DLC: ${isDLC}, Video: ${isVideo}, Demo: ${isDemo}, Tool: ${isTool}, Soundtrack: ${isSoundtrack}, AssetPack: ${isAssetPack})`);
                    return false;
                }
                
                // REQUIRE a rating (metacritic or user rating) - don't include games without ratings
                const hasMetacritic = g.metacritic !== null && g.metacritic !== undefined && g.metacritic > 0;
                const hasRating = g.rating !== null && g.rating !== undefined && g.rating > 0;
                
                // Only include games with ratings
                return (hasMetacritic || hasRating);
            });

            // Sort by rating (highest to lowest) - prioritize metacritic, then user rating
            gamesWithRatings.sort((a, b) => {
                const scoreA = (a.metacritic || 0) * 10 + (a.rating || 0) * 2;
                const scoreB = (b.metacritic || 0) * 10 + (b.rating || 0) * 2;
                return scoreB - scoreA;
            });

            console.log(`📊 [Search] Filtered to ${gamesWithRatings.length} games with ratings (from ${gamesWithDetails.filter(g => g !== null).length} total games with details)`);

            // Paginate after sorting by ratings
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedGames = gamesWithRatings.slice(startIndex, endIndex);

            const result = {
                success: true,
                games: paginatedGames,
                totalResults: gamesWithRatings.length,
                currentPage: page,
                totalPages: gamesWithRatings.length > 0 ? Math.ceil(gamesWithRatings.length / pageSize) : 0,
                isMockData: false
            };
            
            console.log(`✅ [Search] Completed: Returning ${result.games.length} games`);
            if (gamesWithRatings.length === 0) {
                console.log(`ℹ️ [Search] No games found matching "${query}" - try a different search term`);
            }
            return result;
        } catch (error) {
            console.error(`❌ [Search] Error searching Steam games:`, error.message);
            console.error(`   Stack:`, error.stack?.split('\n').slice(0, 3).join('\n'));
            // Fallback to mock data
            console.log(`⚠️ [Search] Falling back to mock data due to error`);
            const mockResult = this.getMockSearchResults(query, page, pageSize);
            mockResult.isMockData = true;
            return mockResult;
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

            console.log('🔄 Fetching Steam app list from Steam API (this may take 30-60 seconds)...');
            const startTime = Date.now();
            
            try {
                const response = await axios.get(`${this.steamApiBase}/ISteamApps/GetAppList/v0002/`, {
                    timeout: 120000, // 120 second timeout for large response
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Game-Vault/1.0'
                    }
                });
                const fetchTime = Date.now() - startTime;
                console.log(`⏱️ Steam API responded in ${fetchTime}ms`);

                if (!response.data) {
                    console.error('❌ Steam API returned no data');
                    throw new Error('No data in Steam API response');
                }

                if (!response.data.applist) {
                    console.error('❌ Steam API response missing applist. Response keys:', Object.keys(response.data));
                    throw new Error('Invalid Steam API response format - missing applist');
                }

                if (!response.data.applist.apps || !Array.isArray(response.data.applist.apps)) {
                    console.error('❌ Steam API response missing apps array');
                    throw new Error('Invalid Steam API response format - missing apps array');
                }

                console.log(`📦 Received ${response.data.applist.apps.length} apps from Steam API`);
                
                const filterStartTime = Date.now();
                // Filter out non-games (DLCs, videos, etc. typically have appid < 1000)
                // Also filter out test apps, tools, DLCs, videos, and trailers
                const games = response.data.applist.apps.filter(app => {
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
                const filterTime = Date.now() - filterStartTime;
                console.log(`🔍 Filtered ${games.length} games in ${filterTime}ms`);

                if (games.length === 0) {
                    console.warn('⚠️ No games after filtering - check filter criteria');
                    // Return unfiltered apps if filtering removed everything (shouldn't happen but safety check)
                    if (response.data.applist.apps.length > 0) {
                        console.log('📋 Returning unfiltered app list as fallback');
                        this.appListCache = response.data.applist.apps;
                        this.appListCacheTime = Date.now();
                        return this.appListCache;
                    }
                    throw new Error('No games found in Steam app list');
                }

                // Cache the results
                this.appListCache = games;
                this.appListCacheTime = Date.now();
                
                console.log(`✅ Successfully cached ${games.length} Steam games (filtered from ${response.data.applist.apps.length} total apps)`);
                return games;
            } catch (axiosError) {
                console.error('❌ Axios error fetching Steam app list:', axiosError.message);
                if (axiosError.response) {
                    console.error(`   Status: ${axiosError.response.status}`);
                    console.error(`   Status Text: ${axiosError.response.statusText}`);
                }
                if (axiosError.code === 'ECONNABORTED') {
                    console.error('   ⚠️ Request timed out - Steam API may be slow');
                }
                throw axiosError;
            }
        } catch (error) {
            console.error('❌ Error fetching Steam app list:', error.message);
            if (error.stack) {
                console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
            }
            
            // Return cached data if available, even if expired
            if (this.appListCache && this.appListCache.length > 0) {
                console.log(`⚠️ Using expired cache (${this.appListCache.length} games) due to error`);
                return this.appListCache;
            }
            
            console.error('❌ No cached data available and Steam API failed');
            return [];
        }
    }

    async getSteamGameDetails(appId) {
        try {
            console.log(`Fetching Steam game details for app ID: ${appId}`);
            const response = await axios.get(`${this.steamStoreBase}/appdetails`, {
                params: {
                    appids: appId,
                    l: 'english'
                },
                timeout: 15000
            });

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
            console.error(`Error fetching Steam game details for ${appId}:`, error.message);
            if (error.response) {
                console.error(`Response status: ${error.response.status}`);
            }
            return null;
        }
    }

    formatSteamGameData(game, details) {
        // Use details if available, otherwise use basic app list data
        if (details) {
            return {
                id: game.appid,
                name: details.name || game.name,
                slug: details.name ? details.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '',
                description: details.short_description || details.detailed_description || 'No description available',
                description_raw: details.detailed_description || details.short_description || 'No description available',
                released: details.release_date && details.release_date.date ? details.release_date.date : 'TBA',
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
        // Mock data for demonstration when Steam API is not available
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

    // Get trending games (most played games from Steam)
    async getTrendingGames(limit = 8) {
        try {
            console.log(`🔍 [Trending] Fetching most played games from Steam...`);
            
            // Get Steam app list (cached)
            const appList = await this.getSteamAppList();
            
            if (!appList || appList.length === 0) {
                console.log('⚠️ [Trending] No Steam app list available');
                return { success: true, games: [] };
            }

            // Start with first 200 games (typically most established/popular)
            // We'll sample from this list to get player counts
            const sampleSize = Math.min(200, appList.length);
            const sampleGames = appList.slice(0, sampleSize);
            
            // Fetch details and player counts in batches
            const batchSize = 10;
            const gamesWithPlayerCounts = [];
            const targetGames = limit * 5; // Fetch 5x the limit to ensure we get good results
            
            for (let i = 0; i < Math.min(sampleGames.length, targetGames); i += batchSize) {
                const batch = sampleGames.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (game) => {
                        try {
                            const details = await this.getSteamGameDetails(game.appid);
                            if (details) {
                                const formattedGame = this.formatSteamGameData(game, details);
                                // Get current player count
                                const playerCount = await this.getCurrentPlayerCount(game.appid);
                                formattedGame.currentPlayers = playerCount;
                                return formattedGame;
                            }
                            return null;
                        } catch (error) {
                            return null;
                        }
                    })
                );
                
                const validGames = batchResults.filter(g => g !== null);
                gamesWithPlayerCounts.push(...validGames);
                
                // Sort what we have so far by player count
                gamesWithPlayerCounts.sort((a, b) => (b.currentPlayers || 0) - (a.currentPlayers || 0));
                
                // If we have enough games with significant player counts, stop early
                const gamesWithPlayers = gamesWithPlayerCounts.filter(g => (g.currentPlayers || 0) > 0);
                if (gamesWithPlayers.length >= limit * 2) {
                    console.log(`✅ [Trending] Found ${gamesWithPlayers.length} games with players, stopping early`);
                    break;
                }
            }

            // Filter to only games with ratings (as a quality filter)
            // But prioritize player count for sorting
            const ratedGames = gamesWithPlayerCounts.filter(g => {
                if (!g) return false;
                const hasMetacritic = g.metacritic !== null && g.metacritic !== undefined && g.metacritic > 0;
                const hasRating = g.rating !== null && g.rating !== undefined && g.rating > 0;
                // Prioritize games with both player count and ratings
                return (hasMetacritic || hasRating) && (g.currentPlayers || 0) > 0;
            });

            // If we don't have enough rated games with players, include games with just players
            if (ratedGames.length < limit) {
                const gamesWithJustPlayers = gamesWithPlayerCounts.filter(g => {
                    if (!g || !g.currentPlayers || g.currentPlayers === 0) return false;
                    const hasMetacritic = g.metacritic !== null && g.metacritic !== undefined && g.metacritic > 0;
                    const hasRating = g.rating !== null && g.rating !== undefined && g.rating > 0;
                    return !hasMetacritic && !hasRating; // Games with players but no ratings
                });
                ratedGames.push(...gamesWithJustPlayers);
            }

            // Sort by player count (highest first)
            ratedGames.sort((a, b) => (b.currentPlayers || 0) - (a.currentPlayers || 0));

            const topGames = ratedGames.slice(0, limit);
            console.log(`✅ [Trending] Found ${topGames.length} most played games from Steam (checked ${gamesWithPlayerCounts.length} games)`);
            
            // Log top games for debugging
            topGames.forEach((g, idx) => {
                console.log(`  ${idx + 1}. ${g.name}: ${g.currentPlayers || 0} players`);
            });

            return {
                success: true,
                games: topGames
            };
        } catch (error) {
            console.error('❌ [Trending] Error fetching trending games:', error.message);
            return { success: true, games: [] };
        }
    }

    // Get popular/highest-rated games from Steam
    async getPopularGamesFallback(limit = 8) {
        try {
            console.log(`🔍 [Trending] Fetching highest-rated games from Steam...`);
            
            // Get Steam app list (cached)
            const appList = await this.getSteamAppList();
            
            if (!appList || appList.length === 0) {
                console.log('⚠️ [Trending] No Steam app list available');
                return { success: true, games: [] };
            }

            // Focus on the first portion of the app list - these are typically more established/popular games
            // Steam's app list is roughly sorted by popularity/age (older, more popular games first)
            // Check first 2000 games for best selection
            const sampleSize = Math.min(2000, appList.length);
            const sampleGames = appList.slice(0, sampleSize);
            
            // Fetch details in batches
            const batchSize = 10;
            const gamesWithDetails = [];
            const targetGames = limit * 15; // Fetch even more to ensure we get enough with high ratings
            
            for (let i = 0; i < Math.min(sampleGames.length, targetGames); i += batchSize) {
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
                
                // Count how many games we have with ratings so far
                const ratedCount = gamesWithDetails.filter(g => {
                    if (!g) return false;
                    const hasMetacritic = g.metacritic !== null && g.metacritic !== undefined && g.metacritic > 0;
                    const hasRating = g.rating !== null && g.rating !== undefined && g.rating > 0;
                    return hasMetacritic || hasRating;
                }).length;
                
                // Stop if we have enough highly-rated games (at least 3x the limit to ensure quality)
                if (ratedCount >= limit * 3) break;
                
                // Also stop if we've fetched enough games overall (even if not all have ratings)
                if (gamesWithDetails.length >= targetGames) break;
            }

            // Filter games with ratings (require at least one rating type)
            const ratedGames = gamesWithDetails.filter(g => {
                if (!g) return false;
                const hasMetacritic = g.metacritic !== null && g.metacritic !== undefined && g.metacritic > 0;
                const hasRating = g.rating !== null && g.rating !== undefined && g.rating > 0;
                return hasMetacritic || hasRating;
            });

            // Sort by rating score (highest first) - prioritize metacritic, then user rating, then review count
            ratedGames.sort((a, b) => {
                const scoreA = (a.metacritic || 0) * 10 + (a.rating || 0) * 3 + Math.min(a.ratingsCount || 0, 50000) / 1000;
                const scoreB = (b.metacritic || 0) * 10 + (b.rating || 0) * 3 + Math.min(b.ratingsCount || 0, 50000) / 1000;
                return scoreB - scoreA;
            });

            const topGames = ratedGames.slice(0, limit);
            console.log(`✅ [Trending] Found ${topGames.length} highest-rated games from Steam (checked ${gamesWithDetails.length} games, ${ratedGames.length} had ratings)`);

            return {
                success: true,
                games: topGames
            };
        } catch (error) {
            console.error('❌ [Trending] Error fetching trending games:', error.message);
            return { success: true, games: [] };
        }
    }

    // Get recent games (newly released)
    async getRecentGames(limit = 8) {
        try {
            console.log(`🔍 [Recent] Fetching recent games from Steam...`);
            
            // Get Steam app list (cached)
            const appList = await this.getSteamAppList();
            
            if (!appList || appList.length === 0) {
                console.log('⚠️ [Recent] No Steam app list available, returning empty');
                return { success: true, games: [] };
            }

            // Take games from the end of the list (newer games typically have higher app IDs)
            // Also take some from middle for variety
            const recentSampleSize = Math.min(200, appList.length);
            const recentIndices = [
                ...Array.from({ length: recentSampleSize }, (_, i) => appList.length - 1 - i), // Last N games
                ...Array.from({ length: recentSampleSize }, (_, i) => Math.floor(appList.length * 0.8) + i) // Games from 80% through list
            ];
            
            const sampleGames = recentIndices
                .filter(idx => idx >= 0 && idx < appList.length)
                .map(idx => appList[idx]);

            // Fetch details in batches
            const batchSize = 10;
            const gamesWithDetails = [];
            
            for (let i = 0; i < Math.min(recentSampleSize * 2, sampleGames.length); i += batchSize) {
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
                
                if (gamesWithDetails.length >= limit * 3) break;
            }

            // Filter games with release dates - prefer those with ratings too
            let gamesWithDates = gamesWithDetails.filter(g => {
                if (!g || !g.released) return false;
                return g.released !== 'TBA' && g.released !== 'No release date';
            });
            
            // Prefer games with ratings if we have enough
            const gamesWithRatingsAndDates = gamesWithDates.filter(g => {
                const hasMetacritic = g.metacritic !== null && g.metacritic !== undefined && g.metacritic > 0;
                const hasRating = g.rating !== null && g.rating !== undefined && g.rating > 0;
                return hasMetacritic || hasRating;
            });
            
            // Use games with ratings if we have enough, otherwise use all games with dates
            if (gamesWithRatingsAndDates.length >= limit) {
                gamesWithDates = gamesWithRatingsAndDates;
            }

            // Sort by release date (newest first), but prioritize games with ratings
            gamesWithDates.sort((a, b) => {
                // First, prioritize games with ratings
                const aHasRating = (a.metacritic > 0) || (a.rating > 0);
                const bHasRating = (b.metacritic > 0) || (b.rating > 0);
                if (aHasRating && !bHasRating) return -1;
                if (!aHasRating && bHasRating) return 1;
                
                // Then sort by release date (newest first)
                const dateA = new Date(a.released);
                const dateB = new Date(b.released);
                if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                return dateB - dateA; // Newest first
            });

            const recentGames = gamesWithDates.slice(0, limit);
            console.log(`✅ [Recent] Found ${recentGames.length} recent games (with ratings where available)`);

            return {
                success: true,
                games: recentGames
            };
        } catch (error) {
            console.error('❌ [Recent] Error fetching recent games:', error.message);
            return { success: true, games: [] };
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

    // Get mock trending games with real IGDB images
    async getMockTrendingGamesWithRealImages(limit = 8) {
        const popularGames = [
            { name: "The Witcher 3: Wild Hunt", id: 1 },
            { name: "Cyberpunk 2077", id: 2 },
            { name: "Elden Ring", id: 3 },
            { name: "God of War", id: 4 },
            { name: "Red Dead Redemption 2", id: 5 },
            { name: "The Last of Us Part II", id: 6 },
            { name: "Ghost of Tsushima", id: 7 },
            { name: "Horizon Zero Dawn", id: 8 }
        ];

        const gamesWithRealImages = [];

        for (const game of popularGames.slice(0, limit)) {
            try {
                if (!this.accessToken) {
                    await this.getAccessToken();
                }

                // Search for the specific game in IGDB
                const searchQuery = `fields name,summary,rating,rating_count,first_release_date,cover.url,platforms.name,genres.name;
search "${game.name}";
where category = 0;
limit 1;`;

                const response = await axios.post(`${this.baseUrl}/games`, searchQuery, {
                    headers: {
                        'Client-ID': this.clientId,
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Accept': 'application/json',
                        'Content-Type': 'text/plain'
                    },
                    transformRequest: [(data) => data],
                    timeout: 10000
                });

                if (response.data && response.data.length > 0) {
                    const igdbGame = response.data[0];
                    const formattedGame = this.formatIGDBGameData(igdbGame);
                    gamesWithRealImages.push(formattedGame);
                } else {
                    // Fallback to mock data if IGDB doesn't have the game
                    const mockGames = this.getMockTrendingGames(8).games;
                    const mockGame = mockGames.find(g => g.name === game.name) || mockGames[0];
                    if (mockGame) {
                        gamesWithRealImages.push(mockGame);
                    }
                }
            } catch (error) {
                console.error(`Error fetching real image for ${game.name}:`, error);
                // Fallback to mock data
                const mockGames = this.getMockTrendingGames(8).games;
                const mockGame = mockGames.find(g => g.name === game.name) || mockGames[0];
                if (mockGame) {
                    gamesWithRealImages.push(mockGame);
                }
            }
        }

        return {
            success: true,
            games: gamesWithRealImages,
            totalResults: gamesWithRealImages.length
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
}

module.exports = GameSearchService;
