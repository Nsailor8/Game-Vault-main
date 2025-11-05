const axios = require('axios');

class SteamService {
    constructor() {
        this.apiKey = process.env.STEAM_API_KEY;
        this.baseUrl = 'https://api.steampowered.com';
    }

    /**
     * Get user's Steam profile information
     * @param {string} steamId - Steam ID
     * @returns {Object} Steam profile data
     */
    async getUserProfile(steamId) {
        try {
            if (!this.apiKey || this.apiKey === 'your-steam-api-key-here') {
                throw new Error('Steam API key not configured');
            }

            const response = await axios.get(`${this.baseUrl}/ISteamUser/GetPlayerSummaries/v0002/`, {
                params: {
                    key: this.apiKey,
                    steamids: steamId
                }
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
                throw new Error('Steam profile not found');
            }
        } catch (error) {
            console.error('Error fetching Steam profile:', error);
            return {
                success: false,
                error: 'Failed to fetch Steam profile',
                profile: null
            };
        }
    }

    /**
     * Get user's Steam game library
     * @param {string} steamId - Steam ID
     * @returns {Object} Steam game library data
     */
    async getUserGameLibrary(steamId) {
        try {
            if (!this.apiKey || this.apiKey === 'your-steam-api-key-here') {
                throw new Error('Steam API key not configured');
            }

            const response = await axios.get(`${this.baseUrl}/IPlayerService/GetOwnedGames/v0001/`, {
                params: {
                    key: this.apiKey,
                    steamid: steamId,
                    include_appinfo: true,
                    include_played_free_games: true
                }
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
                    // Add achievement count if available
                    achievements: game.achievements || 0
                })),
                game_count: response.data.response.game_count || games.length
            };
        } catch (error) {
            console.error('Error fetching Steam game library:', error);
            return {
                success: false,
                error: 'Failed to fetch Steam game library',
                games: [],
                game_count: 0
            };
        }
    }

    /**
     * Get user's achievements for a specific game
     * @param {string} steamId - Steam ID
     * @param {number} appId - Steam App ID
     * @returns {Object} Game achievements data
     */
    async getUserAchievements(steamId, appId) {
        try {
            if (!this.apiKey || this.apiKey === 'your-steam-api-key-here') {
                throw new Error('Steam API key not configured');
            }

            const response = await axios.get(`${this.baseUrl}/ISteamUserStats/GetPlayerAchievements/v0001/`, {
                params: {
                    key: this.apiKey,
                    steamid: steamId,
                    appid: appId
                }
            });

            const achievements = response.data.playerstats?.achievements || [];
            
            return {
                success: true,
                achievements: achievements.map(achievement => ({
                    apiname: achievement.apiname,
                    achieved: achievement.achieved === 1,
                    unlocktime: achievement.unlocktime,
                    name: achievement.apiname, // Steam API doesn't provide display names in this endpoint
                    description: achievement.apiname // Steam API doesn't provide descriptions in this endpoint
                }))
            };
        } catch (error) {
            console.error('Error fetching Steam achievements:', error);
            return {
                success: false,
                error: 'Failed to fetch Steam achievements',
                achievements: []
            };
        }
    }

    /**
     * Get Steam game details
     * @param {number} appId - Steam App ID
     * @returns {Object} Game details
     */
    async getGameDetails(appId) {
        try {
            if (!this.apiKey || this.apiKey === 'your-steam-api-key-here') {
                throw new Error('Steam API key not configured');
            }

            // Steam Store API endpoint for game details
            const response = await axios.get(`https://store.steampowered.com/api/appdetails`, {
                params: {
                    appids: appId,
                    l: 'english'
                }
            });

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
                        release_date: gameData.release_date
                    }
                };
            } else {
                throw new Error('Game not found');
            }
        } catch (error) {
            console.error('Error fetching Steam game details:', error);
            return {
                success: false,
                error: 'Failed to fetch Steam game details',
                game: null
            };
        }
    }

    /**
     * Sync user's Steam library to database
     * @param {Object} user - User model instance
     * @returns {Object} Sync result
     */
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

            // Update user's Steam games
            user.steam_games = libraryResult.games;
            user.steam_last_sync = new Date();
            
            // Calculate and update statistics
            const totalPlaytime = libraryResult.games.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
            const totalAchievements = libraryResult.games.reduce((sum, game) => sum + (game.achievements || 0), 0);
            
            // Update user statistics with Steam data
            if (!user.statistics) {
                user.statistics = {};
            }
            user.statistics.totalGamesPlayed = libraryResult.game_count;
            user.statistics.totalPlaytime = Math.round(totalPlaytime / 60); // Convert to hours
            user.statistics.totalAchievements = totalAchievements;
            // Keep existing averageRating if it exists, otherwise set to 0
            if (user.statistics.averageRating === undefined) {
                user.statistics.averageRating = 0;
            }
            
            // Save to database
            await user.save();
            
            console.log('Steam games and statistics saved to database successfully');

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

    /**
     * Link Steam account to user
     * @param {Object} user - User model instance
     * @param {string} steamId - Steam ID
     * @param {Object} steamProfile - Steam profile data
     * @returns {Object} Link result
     */
    async linkSteamAccount(user, steamId, steamProfile) {
        try {
            console.log('Linking Steam account:', { steamId, username: user.username });
            
            // Update user with Steam data
            user.steam_id = steamId;
            user.steam_profile = steamProfile;
            user.steam_linked_at = new Date();
            
            // Save to database
            await user.save();
            
            console.log('Steam account linked and saved to database');

            // Sync games after linking
            const syncResult = await this.syncUserGames(user);
            console.log('Steam games synced:', syncResult);
            
            return {
                success: true,
                message: 'Steam account linked successfully',
                syncResult: syncResult
            };
        } catch (error) {
            console.error('Error linking Steam account:', error);
            return {
                success: false,
                error: 'Failed to link Steam account'
            };
        }
    }

    /**
     * Unlink Steam account from user
     * @param {Object} user - User model instance
     * @returns {Object} Unlink result
     */
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

    /**
     * Check if user owns a specific Steam game
     * @param {Object} user - User model instance
     * @param {number} appId - Steam App ID
     * @returns {boolean} Whether user owns the game
     */
    userOwnsGame(user, appId) {
        if (!user.steam_games || !Array.isArray(user.steam_games)) {
            return false;
        }
        
        return user.steam_games.some(game => game.appid === appId);
    }

    /**
     * Get Steam ownership status for games
     * @param {Object} user - User model instance
     * @param {Array} games - Array of games to check
     * @returns {Array} Games with Steam ownership status
     */
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
