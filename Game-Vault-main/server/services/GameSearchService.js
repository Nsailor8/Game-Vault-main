const axios = require('axios');

class GameSearchService {
    constructor() {

        this.clientId = process.env.IGDB_CLIENT_ID || 'your-client-id-here';
        this.clientSecret = process.env.IGDB_CLIENT_SECRET || 'your-client-secret-here';
        this.baseUrl = 'https://api.igdb.com/v4';
        this.accessToken = null;
    }

    async searchGames(query, page = 1, pageSize = 20) {
        try {

            if (!this.clientId || this.clientId === 'your-client-id-here' || 
                !this.clientSecret || this.clientSecret === 'your-client-secret-here') {
                console.log('IGDB API credentials not configured, using mock data');
                return this.getMockSearchResults(query, page, pageSize);
            }

            if (!this.accessToken) {
                await this.getAccessToken();
            }
            
            console.log('IGDB API - Client ID:', this.clientId);
            console.log('IGDB API - Access Token:', this.accessToken ? 'Present' : 'Missing');

            const searchQuery = `fields name,summary,rating,rating_count,first_release_date,cover.url,platforms.name,genres.name;
search "${query}";
limit ${pageSize};`;

            const response = await axios.post(`${this.baseUrl}/games`, searchQuery, {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });

            console.log('IGDB API Response:', JSON.stringify(response.data, null, 2));

            return {
                success: true,
                games: response.data.map(game => this.formatIGDBGameData(game)),
                totalResults: response.data.length,
                currentPage: page,
                totalPages: Math.ceil(response.data.length / pageSize)
            };
        } catch (error) {
            console.error('Error searching games:', error);

            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.log('IGDB API credentials invalid, using mock data');
                return this.getMockSearchResults(query, page, pageSize);
            }
            
            return {
                success: false,
                error: 'Failed to search games. Please try again.',
                games: [],
                totalResults: 0
            };
        }
    }

    async getAccessToken() {
        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials'
                }
            });
            this.accessToken = response.data.access_token;
        } catch (error) {
            console.error('Error getting IGDB access token:', error);
            throw error;
        }
    }

    formatIGDBGameData(game) {
        return {
            id: game.id,
            name: game.name,
            slug: game.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            description_raw: game.summary || 'No description available',
            released: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : 'Unknown',
            rating: game.rating && typeof game.rating === 'number' ? parseFloat((game.rating / 10).toFixed(1)) : 0,
            rating_top: 5,
            ratings_count: game.rating_count || 0,
            metacritic: null,
            playtime: null,
            platforms: game.platforms ? game.platforms.map(p => ({
                id: p.id || 0,
                name: p.name || 'Unknown',
                slug: p.name ? p.name.toLowerCase().replace(/\s+/g, '-') : 'unknown'
            })) : [],
            genres: game.genres ? game.genres.map(g => ({
                id: g.id || 0,
                name: g.name || 'Unknown',
                slug: g.name ? g.name.toLowerCase().replace(/\s+/g, '-') : 'unknown'
            })) : [],
            developers: game.developers ? game.developers.map(d => ({
                id: d.id || 0,
                name: d.name || 'Unknown',
                slug: d.name ? d.name.toLowerCase().replace(/\s+/g, '-') : 'unknown'
            })) : [],
            publishers: game.publishers ? game.publishers.map(p => ({
                id: p.id || 0,
                name: p.name || 'Unknown',
                slug: p.name ? p.name.toLowerCase().replace(/\s+/g, '-') : 'unknown'
            })) : [],
            background_image: game.cover && game.cover.url ? `https:${game.cover.url.replace('thumb', 'cover_big')}` : null,
            short_screenshots: []
        };
    }

    getMockSearchResults(query, page = 1, pageSize = 20) {

        const mockGames = [
            {
                id: 1,
                name: `Sample Game: ${query}`,
                slug: `sample-game-${query.toLowerCase().replace(/\s+/g, '-')}`,
                description_raw: `This is a sample game result for "${query}". To get real game data, please configure your RAWG.io API key.`,
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
                description_raw: `Another sample game result for "${query}". Configure your RAWG.io API key for real data.`,
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

        return {
            success: true,
            games: mockGames.map(game => this.formatGameData(game)),
            totalResults: mockGames.length,
            currentPage: page,
            totalPages: 1,
            isMockData: true
        };
    }

    async getGameDetails(gameId) {
        try {
            const response = await axios.get(`${this.baseUrl}/games/${gameId}`, {
                params: {
                    key: this.apiKey
                }
            });

            return {
                success: true,
                game: this.formatGameData(response.data)
            };
        } catch (error) {
            console.error('Error fetching game details:', error);
            return {
                success: false,
                error: 'Failed to fetch game details.',
                game: null
            };
        }
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
}

module.exports = GameSearchService;
