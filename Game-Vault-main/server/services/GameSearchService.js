const axios = require('axios');
const https = require('https');

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
            
            // IGDB API query - simplified format that works
            const searchQuery = `fields name,summary,rating,rating_count,first_release_date,cover.url,platforms.name,genres.name;
search "${query}";
limit ${pageSize};`;

            // Use axios with proper configuration for IGDB API
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

            console.log('IGDB API Response:', JSON.stringify(response.data, null, 2));

            // Filter out games with similar titles to prevent duplicates
            const uniqueGames = this.removeSimilarTitles(response.data);
            
            // Filter out games without ratings
            const gamesWithRatings = uniqueGames.filter(game => game.rating && game.rating > 0);
            
            return {
                success: true,
                games: gamesWithRatings.map(game => this.formatIGDBGameData(game)),
                totalResults: gamesWithRatings.length,
                currentPage: page,
                totalPages: Math.ceil(gamesWithRatings.length / pageSize)
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

    // Helper method to make IGDB API calls using native https module
    async makeIGDBRequest(query) {
        return new Promise((resolve, reject) => {
            console.log('Making IGDB request with query:', query);
            console.log('Access token:', this.accessToken ? 'Present' : 'Missing');
            
            const options = {
                hostname: 'api.igdb.com',
                port: 443,
                path: '/v4/games',
                method: 'POST',
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'text/plain',
                    'Content-Length': Buffer.byteLength(query, 'utf8')
                }
            };

            const req = https.request(options, (res) => {
                console.log('IGDB Response status:', res.statusCode);
                console.log('IGDB Response headers:', res.headers);
                
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    console.log('IGDB Raw response:', data);
                    try {
                        const parsedData = JSON.parse(data);
                        console.log('IGDB Parsed response:', parsedData);
                        resolve(parsedData);
                    } catch (error) {
                        console.error('Failed to parse IGDB response:', error);
                        console.error('Raw data:', data);
                        reject(new Error(`Failed to parse IGDB response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('IGDB Request error:', error);
                reject(error);
            });

            req.write(query, 'utf8');
            req.end();
        });
    }

    formatIGDBGameData(game) {
        return {
            id: game.id,
            name: game.name,
            slug: game.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            description_raw: game.summary || 'No description available',
            released: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : 'Unknown',
            rating: game.rating && typeof game.rating === 'number' ? parseFloat((game.rating / 20).toFixed(1)) : 0,
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
            background_image: game.cover && game.cover.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
            short_screenshots: []
        };
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

    // Get trending games (highly rated games)
    async getTrendingGames(limit = 8) {
        try {
            // Use mock data with known working image URLs for popular games
            console.log('Using mock trending games data with correct image URLs');
            return this.getMockTrendingGamesWithCorrectImages(limit);
        } catch (error) {
            console.error('Error fetching trending games:', error);
            return this.getMockTrendingGames(limit);
        }
    }

    // Get recent games (newly released)
    async getRecentGames(limit = 8) {
        try {
            // Use mock data for recent games to ensure we get popular, well-known games
            console.log('Using mock recent games data with correct image URLs');
            return this.getMockRecentGames(limit);
        } catch (error) {
            console.error('Error fetching recent games:', error);
            return this.getMockRecentGames(limit);
        }
    }

    // Get search suggestions for autocomplete
    async getSearchSuggestions(query, limit = 5) {
        try {
            if (!this.accessToken) {
                await this.getAccessToken();
            }

            // IGDB API query for search suggestions - simplified format
            const suggestionsQuery = `fields name,first_release_date,rating,cover.url;
search "${query}";
limit ${limit};`;

            const response = await axios.post(`${this.baseUrl}/games`, suggestionsQuery, {
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
                // Filter out games without ratings first
                const gamesWithRatings = response.data.filter(game => game.rating && game.rating > 0);
                
                const suggestions = gamesWithRatings.map(game => ({
                    name: game.name,
                    released: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : null,
                    rating: game.rating ? parseFloat((game.rating / 20).toFixed(1)) : 0,
                    cover: game.cover ? `https:${game.cover.url}` : null
                }));

                return {
                    success: true,
                    suggestions: this.removeSimilarTitles(suggestions)
                };
            } else {
                return {
                    success: true,
                    suggestions: []
                };
            }
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
