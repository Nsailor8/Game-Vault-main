const axios = require('axios');

class SteamService {
    constructor() {
        this.apiKey = process.env.STEAM_API_KEY;
        this.baseUrl = 'https://api.steampowered.com';
    }

    async getUserProfile(steamId) {
        try {
            if (!this.apiKey || this.apiKey === 'your-steam-api-key-here') {
                console.error('Steam API key not configured - required for getUserProfile');
                return {
                    success: false,
                    error: 'Steam API key not configured. Please set STEAM_API_KEY environment variable.',
                    profile: null
                };
            }

            const response = await axios.get(`${this.baseUrl}/ISteamUser/GetPlayerSummaries/v0002/`, {
                params: {
                    key: this.apiKey,
                    steamids: steamId
                },
                timeout: 10000
            });

            const players = response.data.response.players;
            if (players && players.length > 0) {
                const player = players[0];
                return {
                    success: true,
                    profile: {
                        steamid: player.steamid,
                        personaname: player.personaname,
                        profileurl: player.profileurl,
                        avatar: player.avatar,
                        avatarmedium: player.avatarmedium,
                        avatarfull: player.avatarfull,
                        personastate: player.personastate,
                        communityvisibilitystate: player.communityvisibilitystate,
                        profilestate: player.profilestate,
                        lastlogoff: player.lastlogoff,
                        commentpermission: player.commentpermission
                    }
                };
            } else {
                console.error(`Steam profile not found for Steam ID: ${steamId}`);
                return {
                    success: false,
                    error: 'Steam profile not found or profile is private',
                    profile: null
                };
            }
        } catch (error) {
            // Distinguish between different error types
            if (error.response) {
                if (error.response.status === 401 || error.response.status === 403) {
                    console.error(`Steam API authentication error for Steam ID ${steamId}: Invalid API key`);
                    return {
                        success: false,
                        error: 'Steam API authentication failed - check your API key',
                        profile: null
                    };
                }
                console.error(`Steam API error for Steam ID ${steamId}:`, error.response.status, error.response.statusText);
                return {
                    success: false,
                    error: `Steam API error: ${error.response.status} ${error.response.statusText}`,
                    profile: null
                };
            } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                console.error(`Steam API timeout for Steam ID ${steamId}:`, error.message);
                return {
                    success: false,
                    error: 'Request timeout - Steam API is slow or unavailable',
                    profile: null
                };
            } else if (error.request) {
                console.error(`Steam API network error for Steam ID ${steamId}:`, error.message);
                return {
                    success: false,
                    error: 'Network error - could not reach Steam API',
                    profile: null
                };
            } else {
                console.error(`Error fetching Steam profile for Steam ID ${steamId}:`, error.message);
                return {
                    success: false,
                    error: `Failed to fetch Steam profile: ${error.message}`,
                    profile: null
                };
            }
        }
    }

    async getUserGameLibrary(steamId) {
        try {
            console.log('[Steam Service] getUserGameLibrary called for Steam ID:', steamId);
            console.log('[Steam Service] API key configured:', !!(this.apiKey && this.apiKey !== 'your-steam-api-key-here'));
            
            if (!this.apiKey || this.apiKey === 'your-steam-api-key-here') {
                console.error('[Steam Service] Steam API key not configured - required for getUserGameLibrary');
                return {
                    success: false,
                    error: 'Steam API key not configured. Please set STEAM_API_KEY environment variable in your .env file. You can get a free API key from https://steamcommunity.com/dev/apikey',
                    games: [],
                    game_count: 0
                };
            }

            const response = await axios.get(`${this.baseUrl}/IPlayerService/GetOwnedGames/v0001/`, {
                params: {
                    key: this.apiKey,
                    steamid: steamId,
                    include_appinfo: true,
                    include_played_free_games: true
                },
                timeout: 15000
            });

            const games = response.data.response.games || [];
            
            return {
                success: true,
                games: games.map(game => ({
                    appid: game.appid,
                    name: game.name,
                    playtime_forever: game.playtime_forever,
                    playtime_windows_forever: game.playtime_windows_forever || 0,
                    playtime_mac_forever: game.playtime_mac_forever || 0,
                    playtime_linux_forever: game.playtime_linux_forever || 0,
                    rtime_last_played: game.rtime_last_played,
                    playtime_disconnected: game.playtime_disconnected || 0,
                    has_community_visible_stats: game.has_community_visible_stats || false,
                    playtime_2weeks: game.playtime_2weeks || 0,

                    achievements: game.achievements || 0
                })),
                game_count: response.data.response.game_count || games.length
            };
        } catch (error) {
            // Distinguish between different error types
            if (error.response) {
                if (error.response.status === 401 || error.response.status === 403) {
                    console.error(`Steam API authentication error for Steam ID ${steamId}: Invalid API key`);
                    return {
                        success: false,
                        error: 'Steam API authentication failed - check your API key',
                        games: [],
                        game_count: 0
                    };
                }
                console.error(`Steam API error for Steam ID ${steamId}:`, error.response.status, error.response.statusText);
                return {
                    success: false,
                    error: `Steam API error: ${error.response.status} ${error.response.statusText}`,
                    games: [],
                    game_count: 0
                };
            } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                console.error(`Steam API timeout for Steam ID ${steamId}:`, error.message);
                return {
                    success: false,
                    error: 'Request timeout - Steam API is slow or unavailable',
                    games: [],
                    game_count: 0
                };
            } else if (error.request) {
                console.error(`Steam API network error for Steam ID ${steamId}:`, error.message);
                return {
                    success: false,
                    error: 'Network error - could not reach Steam API',
                    games: [],
                    game_count: 0
                };
            } else {
                console.error(`Error fetching Steam game library for Steam ID ${steamId}:`, error.message);
                return {
                    success: false,
                    error: `Failed to fetch Steam game library: ${error.message}`,
                    games: [],
                    game_count: 0
                };
            }
        }
    }

    async getUserAchievements(steamId, appId) {
        try {
            if (!this.apiKey || this.apiKey === 'your-steam-api-key-here') {
                console.error('Steam API key not configured - required for getUserAchievements');
                return {
                    success: false,
                    error: 'Steam API key not configured. Please set STEAM_API_KEY environment variable.',
                    achievements: []
                };
            }

            const response = await axios.get(`${this.baseUrl}/ISteamUserStats/GetPlayerAchievements/v0001/`, {
                params: {
                    key: this.apiKey,
                    steamid: steamId,
                    appid: appId
                },
                timeout: 10000
            });

            const achievements = response.data.playerstats?.achievements || [];
            
            return {
                success: true,
                achievements: achievements.map(achievement => ({
                    apiname: achievement.apiname,
                    achieved: achievement.achieved === 1,
                    unlocktime: achievement.unlocktime,
                    name: achievement.apiname,
                    description: achievement.apiname
                }))
            };
        } catch (error) {
            // Distinguish between different error types
            if (error.response) {
                if (error.response.status === 401 || error.response.status === 403) {
                    console.error(`Steam API authentication error for Steam ID ${steamId}, App ID ${appId}: Invalid API key`);
                    return {
                        success: false,
                        error: 'Steam API authentication failed - check your API key',
                        achievements: []
                    };
                }
                console.error(`Steam API error for Steam ID ${steamId}, App ID ${appId}:`, error.response.status, error.response.statusText);
                return {
                    success: false,
                    error: `Steam API error: ${error.response.status} ${error.response.statusText}`,
                    achievements: []
                };
            } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                console.error(`Steam API timeout for Steam ID ${steamId}, App ID ${appId}:`, error.message);
                return {
                    success: false,
                    error: 'Request timeout - Steam API is slow or unavailable',
                    achievements: []
                };
            } else if (error.request) {
                console.error(`Steam API network error for Steam ID ${steamId}, App ID ${appId}:`, error.message);
                return {
                    success: false,
                    error: 'Network error - could not reach Steam API',
                    achievements: []
                };
            } else {
                console.error(`Error fetching Steam achievements for Steam ID ${steamId}, App ID ${appId}:`, error.message);
                return {
                    success: false,
                    error: `Failed to fetch Steam achievements: ${error.message}`,
                    achievements: []
                };
            }
        }
    }

    /**
     * Get Steam game details
     * @param {number} appId - Steam App ID
     * @returns {Object} Game details
     * Note: This uses the public Steam Store API which does not require an API key
     */
    async getGameDetails(appId, retryCount = 0) {
        const maxRetries = 3;
        const baseDelay = 2000; // 2 seconds base delay
        
        try {
            // Steam Store API endpoint for game details (public, no API key required)
            const response = await axios.get(`https://store.steampowered.com/api/appdetails`, {
                params: {
                    appids: appId,
                    l: 'english'
                },
                timeout: 15000
            });

            if (!response.data || !response.data[appId]) {
                console.error(`Steam Store API returned no data for app ID ${appId}`);
                return {
                    success: false,
                    error: 'Game not found or Steam Store API returned no data',
                    game: null
                };
            }

            const appData = response.data[appId];
            if (appData && appData.success) {
                const gameData = appData.data;
                return {
                    success: true,
                    game: {
                        appid: appId,
                        name: gameData.name,
                        type: gameData.type,
                        is_free: gameData.is_free,
                        detailed_description: gameData.detailed_description,
                        short_description: gameData.short_description,
                        supported_languages: gameData.supported_languages,
                        header_image: gameData.header_image,
                        capsule_image: gameData.capsule_image,
                        capsule_imagev5: gameData.capsule_imagev5,
                        website: gameData.website,
                        pc_requirements: gameData.pc_requirements,
                        mac_requirements: gameData.mac_requirements,
                        linux_requirements: gameData.linux_requirements,
                        developers: gameData.developers,
                        publishers: gameData.publishers,
                        price_overview: gameData.price_overview,
                        platforms: gameData.platforms,
                        categories: gameData.categories,
                        genres: gameData.genres,
                        screenshots: gameData.screenshots,
                        movies: gameData.movies,
                        recommendations: gameData.recommendations,
                        achievements: gameData.achievements,
                        release_date: gameData.release_date,
                        metacritic: gameData.metacritic || null // Include Metacritic score
                    }
                };
            } else {
                console.error(`Steam Store API returned success=false for app ID ${appId}`);
                return {
                    success: false,
                    error: 'Game not found or not available',
                    game: null
                };
            }
        } catch (error) {
            // Handle rate limiting (429) with retry logic
            if (error.response && error.response.status === 429) {
                if (retryCount < maxRetries) {
                    const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
                    console.log(`Rate limited (429) for app ID ${appId}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.getGameDetails(appId, retryCount + 1);
                } else {
                    console.error(`Steam Store API rate limit exceeded for app ID ${appId} after ${maxRetries} retries`);
                    return {
                        success: false,
                        error: 'Rate limit exceeded - too many requests to Steam API',
                        game: null
                    };
                }
            }
            
            // Distinguish between different error types
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                console.error(`Steam Store API timeout for app ID ${appId}:`, error.message);
                return {
                    success: false,
                    error: 'Request timeout - Steam Store API is slow or unavailable',
                    game: null
                };
            } else if (error.response) {
                console.error(`Steam Store API error for app ID ${appId}:`, error.response.status, error.response.statusText);
                return {
                    success: false,
                    error: `Steam Store API error: ${error.response.status} ${error.response.statusText}`,
                    game: null
                };
            } else if (error.request) {
                console.error(`Steam Store API network error for app ID ${appId}:`, error.message);
                return {
                    success: false,
                    error: 'Network error - could not reach Steam Store API',
                    game: null
                };
            } else {
                console.error(`Error fetching Steam game details for app ID ${appId}:`, error.message);
                return {
                    success: false,
                    error: `Failed to fetch Steam game details: ${error.message}`,
                    game: null
                };
            }
        }
    }

    async syncUserGames(user) {
        try {
            console.log('Starting Steam games sync for user:', user.username);
            
            if (!user.steam_id) {
                return {
                    success: false,
                    error: 'User has no linked Steam account'
                };
            }

            console.log('Fetching Steam game library for Steam ID:', user.steam_id);
            const libraryResult = await this.getUserGameLibrary(user.steam_id);
            
            if (!libraryResult.success) {
                console.error('Failed to fetch Steam library:', libraryResult.error);
                return libraryResult;
            }

            console.log(`Fetched ${libraryResult.game_count} games from Steam API`);

            // Fetch game details (including ratings and Metacritic) for each game
            // Process sequentially with delays to avoid rate limiting
            // Limit to first 30 games to avoid hitting rate limits
            const gamesToProcess = libraryResult.games.slice(0, 30);
            const gamesWithDetails = [];
            
            console.log(`[Sync] Fetching details for ${gamesToProcess.length} games (sequential with delays to avoid rate limits)...`);
            
            for (let i = 0; i < gamesToProcess.length; i++) {
                const game = gamesToProcess[i];
                try {
                    // Add delay between requests to avoid rate limiting (500ms delay)
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    const detailsResult = await this.getGameDetails(game.appid);
                    if (detailsResult.success && detailsResult.game) {
                        // Extract rating and Metacritic from game details
                        const gameData = detailsResult.game;
                        // Calculate rating from recommendations if available
                        let rating = null;
                        if (gameData.recommendations && gameData.recommendations.total) {
                            // Convert recommendations to a 5-star rating (rough estimate)
                            // This is a simplified calculation
                            rating = Math.min(5, (gameData.recommendations.total / 1000) * 5);
                        }
                        
                        // Get Metacritic score if available
                        const metacritic = gameData.metacritic && gameData.metacritic.score ? gameData.metacritic.score : null;
                        
                        gamesWithDetails.push({
                            ...game,
                            rating: rating,
                            metacritic: metacritic
                        });
                    } else {
                        // If details fetch failed, still include the game without details
                        gamesWithDetails.push(game);
                    }
                } catch (error) {
                    console.error(`[Sync] Error fetching details for game ${game.appid}:`, error.message);
                    // Still include the game even if details fetch fails
                    gamesWithDetails.push(game);
                }
                
                // Log progress every 10 games
                if ((i + 1) % 10 === 0) {
                    console.log(`[Sync] Progress: ${i + 1}/${gamesToProcess.length} games processed`);
                }
            }
            
            console.log(`[Sync] Completed fetching details for ${gamesWithDetails.length} games`);
            
            // Add remaining games without details
            const remainingGames = libraryResult.games.slice(30);
            const allGames = [...gamesWithDetails, ...remainingGames];

            // Fetch achievements for games (limit to first 15 games, sequential to avoid rate limits)
            console.log('[Sync] Fetching achievements for games (sequential with delays)...');
            let totalUnlockedAchievements = 0;
            const gamesToProcessForAchievements = allGames.slice(0, 15);
            const gamesWithAchievementData = [];
            
            for (let i = 0; i < gamesToProcessForAchievements.length; i++) {
                const game = gamesToProcessForAchievements[i];
                try {
                    // Add delay between achievement requests (750ms delay)
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 750));
                    }
                    
                    if (this.apiKey && this.apiKey !== 'your-steam-api-key-here') {
                        const achievementsResult = await this.getUserAchievements(user.steam_id, game.appid);
                        if (achievementsResult.success && achievementsResult.achievements) {
                            const unlockedCount = achievementsResult.achievements.filter(a => a.achieved).length;
                            totalUnlockedAchievements += unlockedCount;
                            gamesWithAchievementData.push({
                                ...game,
                                achievementCount: achievementsResult.achievements.length,
                                unlockedAchievements: unlockedCount,
                                achievements: achievementsResult.achievements
                            });
                        } else {
                            gamesWithAchievementData.push(game);
                        }
                    } else {
                        gamesWithAchievementData.push(game);
                    }
                } catch (error) {
                    console.error(`[Sync] Error fetching achievements for game ${game.appid}:`, error.message);
                    // Still include the game even if achievements fetch fails
                    gamesWithAchievementData.push(game);
                }
            }
            
            // Combine games with achievement data and remaining games
            const remainingGamesWithoutAchievements = allGames.slice(15);
            const finalGames = [...gamesWithAchievementData, ...remainingGamesWithoutAchievements];
            
            console.log('[Sync] Final games array:', {
                totalGames: finalGames.length,
                gamesWithAchievements: gamesWithAchievementData.length,
                remainingGames: remainingGamesWithoutAchievements.length,
                firstGame: finalGames[0] ? { name: finalGames[0].name, appid: finalGames[0].appid } : 'none'
            });

            // Update user's Steam games - use setDataValue for Sequelize instances
            if (user.setDataValue) {
                user.setDataValue('steam_games', finalGames);
                user.setDataValue('steam_last_sync', new Date());
            } else {
                user.steam_games = finalGames;
                user.steam_last_sync = new Date();
            }
            
            // Also set directly
            user.steam_games = finalGames;
            user.steam_last_sync = new Date();
            
            console.log('[Sync] Games set on user object:', {
                direct: user.steam_games ? (Array.isArray(user.steam_games) ? user.steam_games.length : typeof user.steam_games) : 'null',
                getDataValue: user.getDataValue ? (user.getDataValue('steam_games') ? (Array.isArray(user.getDataValue('steam_games')) ? user.getDataValue('steam_games').length : typeof user.getDataValue('steam_games')) : 'null') : 'N/A'
            });
            
            // Calculate and update statistics
            const totalPlaytime = finalGames.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
            const totalAchievementCount = finalGames.reduce((sum, game) => sum + (game.achievementCount || game.achievements || 0), 0);
            
            // Calculate average rating from games with ratings
            const gamesWithRatings = finalGames.filter(game => game.rating && game.rating > 0);
            let averageRating = 0;
            if (gamesWithRatings.length > 0) {
                averageRating = parseFloat((gamesWithRatings.reduce((sum, game) => sum + game.rating, 0) / gamesWithRatings.length).toFixed(1));
            }
            
            // Update user statistics with Steam data
            if (!user.statistics) {
                user.statistics = {};
            }
            user.statistics.totalGamesPlayed = finalGames.length;
            user.statistics.totalPlaytime = Math.round(totalPlaytime / 60); // Convert to hours
            user.statistics.totalAchievements = totalUnlockedAchievements || totalAchievementCount; // Use actual unlocked achievements if available
            user.statistics.averageRating = averageRating;
            
            console.log('Calculated statistics:', {
                totalGames: finalGames.length,
                totalPlaytime: user.statistics.totalPlaytime,
                totalAchievements: user.statistics.totalAchievements,
                averageRating: user.statistics.averageRating
            });
            
            console.log('Saving statistics to database:', {
                totalGamesPlayed: user.statistics.totalGamesPlayed,
                totalPlaytime: user.statistics.totalPlaytime,
                totalAchievements: user.statistics.totalAchievements,
                averageRating: user.statistics.averageRating
            });
            
            // Save to database and wait for it to complete
            console.log('[Sync] Saving user to database with', finalGames.length, 'games...');
            console.log('[Sync] Games array to save:', finalGames.length > 0 ? `First game: ${finalGames[0].name || finalGames[0].appid}` : 'empty array');
            console.log('[Sync] Statistics to save:', user.statistics);
            
            const savedUser = await user.save();
            console.log('[Sync] User saved - checking saved games:', {
                direct: savedUser.steam_games ? (Array.isArray(savedUser.steam_games) ? savedUser.steam_games.length : typeof savedUser.steam_games) : 'null',
                getDataValue: savedUser.getDataValue ? (savedUser.getDataValue('steam_games') ? (Array.isArray(savedUser.getDataValue('steam_games')) ? savedUser.getDataValue('steam_games').length : typeof savedUser.getDataValue('steam_games')) : 'null') : 'N/A'
            });
            
            // Force a database commit by reloading
            console.log('[Sync] Reloading user from database to verify save...');
            await savedUser.reload();
            
            // Verify games were saved
            const reloadedGames = savedUser.steam_games || savedUser.getDataValue?.('steam_games') || savedUser.dataValues?.steam_games;
            console.log('[Sync] After reload - games:', reloadedGames ? (Array.isArray(reloadedGames) ? `array with ${reloadedGames.length} items` : typeof reloadedGames) : 'null');
            
            // Direct database verification - query fresh from database
            const { User } = require('../models/index');
            const verifyUser = await User.findOne({ 
                where: { username: user.username },
                attributes: ['username', 'steam_games', 'steam_last_sync', 'statistics']
            });
            if (verifyUser) {
                const verifiedGames = verifyUser.steam_games || verifyUser.getDataValue?.('steam_games') || verifyUser.dataValues?.steam_games;
                const verifiedStats = verifyUser.statistics || verifyUser.getDataValue?.('statistics') || verifyUser.dataValues?.statistics;
                console.log('[Sync] Database verification - games:', verifiedGames ? (Array.isArray(verifiedGames) ? `array with ${verifiedGames.length} items` : typeof verifiedGames) : 'null');
                console.log('[Sync] Database verification - statistics:', verifiedStats ? JSON.stringify(verifiedStats) : 'none');
                console.log('[Sync] Database verification - totalGamesPlayed:', verifiedStats?.totalGamesPlayed || 0);
                
                if (!verifiedGames || !Array.isArray(verifiedGames) || verifiedGames.length === 0) {
                    console.error('[Sync] WARNING: Games were not saved to database!');
                    console.error('[Sync] Attempted to save', finalGames.length, 'games but database has', verifiedGames ? (Array.isArray(verifiedGames) ? verifiedGames.length : 'non-array') : 'null');
                } else {
                    console.log('[Sync] SUCCESS: Games verified in database -', verifiedGames.length, 'games saved');
                }
            } else {
                console.error('[Sync] Database verification failed - user not found!');
            }
            
            console.log('[Sync] Statistics saved and verified - totalGamesPlayed:', user.statistics?.totalGamesPlayed);
            
            console.log('[Sync] Steam games and statistics saved to database successfully');

            return {
                success: true,
                gamesCount: libraryResult.game_count,
                totalPlaytime: user.statistics.totalPlaytime,
                totalAchievements: user.statistics.totalAchievements,
                message: `Successfully synced ${libraryResult.game_count} games from Steam`,
                lastSync: user.steam_last_sync
            };
        } catch (error) {
            console.error('Error syncing Steam games:', error);
            return {
                success: false,
                error: 'Failed to sync Steam games: ' + error.message
            };
        }
    }

    async linkSteamAccount(user, steamId, steamProfile) {
        try {
            console.log('[Steam Link] ==========================================');
            console.log('[Steam Link] Linking Steam account:', { steamId, username: user.username });
            console.log('[Steam Link] User model type:', user.constructor.name);
            console.log('[Steam Link] User ID:', user.id || user.user_id || user.getDataValue?.('user_id'));
            console.log('[Steam Link] Steam ID to save:', steamId);
            console.log('[Steam Link] Steam profile:', steamProfile ? 'present' : 'missing');
            
            // Update user with Steam data - use setDataValue for Sequelize instances
            if (user.setDataValue) {
                user.setDataValue('steam_id', steamId);
                user.setDataValue('steam_profile', steamProfile);
                user.setDataValue('steam_linked_at', new Date());
            } else {
                user.steam_id = steamId;
                user.steam_profile = steamProfile;
                user.steam_linked_at = new Date();
            }
            
            // Also set directly on the object
            user.steam_id = steamId;
            user.steam_profile = steamProfile;
            user.steam_linked_at = new Date();
            
            console.log('[Steam Link] Steam ID set before save:', user.steam_id);
            
            // Save to database
            const savedUser = await user.save();
            console.log('[Steam Link] User saved - Steam ID after save:', savedUser.steam_id);
            console.log('[Steam Link] Steam ID via getDataValue:', savedUser.getDataValue ? savedUser.getDataValue('steam_id') : 'N/A');
            console.log('[Steam Link] Steam profile saved:', savedUser.steam_profile ? 'yes' : 'no');
            
            // Verify the save worked by querying the database directly
            const { User } = require('../models/index');
            const verifyUser = await User.findOne({ 
                where: { username: user.username },
                attributes: ['username', 'steam_id', 'steam_profile', 'steam_linked_at']
            });
            
            if (verifyUser) {
                console.log('[Steam Link] Verification query - Steam ID:', verifyUser.steam_id);
                console.log('[Steam Link] Verification query - Has profile:', !!verifyUser.steam_profile);
            } else {
                console.error('[Steam Link] Verification query failed - user not found!');
            }
            
            // Reload from database to ensure we have the latest data
            await savedUser.reload();
            console.log('[Steam Link] User reloaded - Steam ID after reload:', savedUser.steam_id);
            console.log('[Steam Link] Steam profile after reload:', savedUser.steam_profile ? 'yes' : 'no');
            console.log('[Steam Link] ==========================================');

            // Auto-sync games immediately after linking
            console.log('[Steam Link] Starting automatic game sync...');
            console.log('[Steam Link] User Steam ID for sync:', savedUser.steam_id);
            
            const syncResult = await this.syncUserGames(savedUser);
            console.log('[Steam Link] Steam games sync result:', syncResult.success ? `success - ${syncResult.gamesCount || 0} games synced` : 'failed - ' + syncResult.error);
            
            if (syncResult.success) {
                console.log('[Steam Link] Sync successful, reloading user to get synced games...');
                // Reload user again after sync to get the synced games
                await savedUser.reload();
                
                const gamesAfterSync = savedUser.steam_games || savedUser.getDataValue?.('steam_games') || savedUser.dataValues?.steam_games;
                console.log('[Steam Link] Games after sync reload:', gamesAfterSync ? (Array.isArray(gamesAfterSync) ? `${gamesAfterSync.length} games` : typeof gamesAfterSync) : 'null');
                
                // Verify games were saved by querying database directly
                const { User } = require('../models/index');
                const verifyUser = await User.findOne({ 
                    where: { username: user.username },
                    attributes: ['username', 'steam_games', 'steam_last_sync', 'statistics']
                });
                if (verifyUser) {
                    const verifiedGames = verifyUser.steam_games || verifyUser.getDataValue?.('steam_games') || verifyUser.dataValues?.steam_games;
                    const verifiedStats = verifyUser.statistics || verifyUser.getDataValue?.('statistics') || verifyUser.dataValues?.statistics;
                    console.log('[Steam Link] Final verification - games in database:', verifiedGames ? (Array.isArray(verifiedGames) ? `${verifiedGames.length} games` : typeof verifiedGames) : 'null');
                    console.log('[Steam Link] Final verification - statistics:', verifiedStats ? JSON.stringify(verifiedStats) : 'none');
                    console.log('[Steam Link] Final verification - totalGamesPlayed:', verifiedStats?.totalGamesPlayed || 0);
                } else {
                    console.error('[Steam Link] Verification query failed - user not found!');
                }
            } else {
                console.error('[Steam Link] Game sync failed:', syncResult.error);
                console.error('[Steam Link] Sync error details:', syncResult);
            }
            
            // Always return success for linking, even if sync fails
            // The account is linked, games just couldn't be synced
            return {
                success: true,
                message: 'Steam account linked successfully',
                syncResult: syncResult,
                gamesSynced: syncResult.success,
                gamesCount: syncResult.gamesCount || 0,
                steamId: savedUser.steam_id
            };
        } catch (error) {
            console.error('Error linking Steam account:', error);
            console.error('Error stack:', error.stack);
            return {
                success: false,
                error: 'Failed to link Steam account: ' + error.message
            };
        }
    }

    async unlinkSteamAccount(user) {
        try {
            user.steam_id = null;
            user.steam_profile = null;
            user.steam_linked_at = null;
            user.steam_games = null;
            user.steam_last_sync = null;
            
            await user.save();

            return {
                success: true,
                message: 'Steam account unlinked successfully'
            };
        } catch (error) {
            console.error('Error unlinking Steam account:', error);
            return {
                success: false,
                error: 'Failed to unlink Steam account'
            };
        }
    }

    userOwnsGame(user, appId) {
        if (!user.steam_games || !Array.isArray(user.steam_games)) {
            return false;
        }
        
        return user.steam_games.some(game => game.appid === appId);
    }

    getSteamOwnershipStatus(user, games) {
        if (!user.steam_games || !Array.isArray(user.steam_games)) {
            return games.map(game => ({ ...game, steamOwned: false }));
        }

        const steamGameIds = user.steam_games.map(game => game.appid);
        
        return games.map(game => ({
            ...game,
            steamOwned: steamGameIds.includes(game.id) || steamGameIds.includes(parseInt(game.id))
        }));
    }
}

module.exports = SteamService;
