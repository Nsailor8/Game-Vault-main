const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const GameSearchService = require('./server/services/GameSearchService');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(cors({
    origin: true, // Allow requests from any origin (for development)
    credentials: true // Allow cookies to be sent
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'game-vault-secret-key',
    resave: true, // Force session to be saved back to session store
    saveUninitialized: true, // Allow saving uninitialized sessions
    rolling: true, // Reset expiration on every request
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true, // Prevent client-side access to cookies
        sameSite: 'lax' // CSRF protection
    }
}));

// Debug middleware to log session info
app.use((req, res, next) => {
    console.log('Session middleware - Session ID:', req.sessionID);
    console.log('Session middleware - Session user:', req.session.user);
    next();
});

// Serve static assets (CSS, JS, images) from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// ===== EJS Setup =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './client/views'));


// ===== Import Profile System Classes =====
const {
    UserProfile,
    ProfileManager,
    FriendsList,
    WishlistManager,
    ReviewManager,
    AdminManager
} = require('./client/profile.js');

// ===== Initialize Managers =====
const profileManager = new ProfileManager();
const adminManager = new AdminManager();
const gameSearchService = new GameSearchService();

let isDatabaseReady = false;

// ===== EJS Page Routes =====
app.use((req, res, next) => {
    res.locals.homeLink = '/';
    res.locals.profileLink = '/profile';
    res.locals.friendsLink = '/friends';

    const pathName = req.path;
    if (pathName.startsWith('/profile')) res.locals.activePage = 'profile';
    else if (pathName.startsWith('/friends')) res.locals.activePage = 'friends';
    else if (pathName.startsWith('/wishlist')) res.locals.activePage = 'wishlist';
    else if (pathName.startsWith('/reviews')) res.locals.activePage = 'reviews';
    else if (pathName.startsWith('/admin')) res.locals.activePage = 'admin';
    else res.locals.activePage = 'home';

    next();
});

// ===== Render EJS Views =====
app.get('/', async (req, res) => {
    try {
        // Fetch trending games from IGDB API
        const trendingGames = await gameSearchService.getTrendingGames();
        const recentGames = await gameSearchService.getRecentGames();
        
        res.render('index', { 
            trendingGames: trendingGames.games || [], 
            recentGames: recentGames.games || [] 
        });
    } catch (error) {
        console.error('Error fetching homepage games:', error);
        res.render('index', { trendingGames: [], recentGames: [] });
    }
});

app.get('/profile', (req, res) => {
    const userId = req.query.userId || null;
    let profile;

    if (userId) {
        const user = profileManager.getUserProfile(userId);
        profile = user || {};
    } else {
        profile = {
            username: '',
            email: '',
            joinDate: '',
            totalGames: 0,
            totalPlaytime: 0,
            avgRating: 0,
            achievementCount: 0,
            bio: '',
            playStyle: '',
            favoriteGenres: [],
            preferredPlatforms: [],
            achievements: []
        };
    }

    res.render('profile', { profile });
});

app.get('/search', (req, res) => {
    console.log('Search route hit with query:', req.query.q);
    res.render('search');
});
app.get('/friends', (req, res) => res.render('friends'));
app.get('/wishlist', (req, res) => res.render('wishlist'));
app.get('/reviews', (req, res) => res.render('reviews'));
app.get('/admin', (req, res) => res.render('admin'));

// ===== API Routes =====

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!profileManager.isInitialized) {
        return res.status(503).json({ error: 'Database not ready yet, please try again' });
    }

    const user = await profileManager.login(username, password);
        if (user) {
            // Store user data in session
            req.session.user = {
                username: user.username,
                email: user.email,
                joinDate: user.joinDate,
                bio: user.bio,
                gamingPreferences: user.gamingPreferences,
                statistics: user.statistics,
                achievements: user.achievements
            };
            
            console.log('Login successful, session user set:', req.session.user);
            console.log('Session ID:', req.sessionID);
            
            // Force session save
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Session save failed' });
                }
                
                console.log('Session saved successfully');
                res.json({
                    success: true,
                    user: req.session.user
                });
            });
        } else {
            console.log('Login failed for username:', username);
            res.status(401).json({ error: 'Invalid credentials' });
        }
});

app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password, gamingPreferences } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (!profileManager.isInitialized) {
        return res.status(503).json({ error: 'Database not ready yet, please try again' });
    }

    try {
        const user = await profileManager.signUp(username, email, password, gamingPreferences || {});
        if (user) {
            // Store user data in session
            req.session.user = {
                username: user.username,
                email: user.email,
                joinDate: user.joinDate,
                bio: user.bio,
                gamingPreferences: user.gamingPreferences,
                statistics: user.statistics,
                achievements: user.achievements
            };
            
            console.log('Signup successful, session user set:', req.session.user);
            console.log('Session ID:', req.sessionID);
            
            // Force session save
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Session save failed' });
                }
                
                console.log('Session saved successfully');
                res.json({
                    success: true,
                    user: req.session.user
                });
            });
        } else {
            res.status(400).json({ error: 'Username already exists' });
        }
    } catch (error) {
        console.error('Error during signup:', error);

        if (error.name === 'SequelizeValidationError') {
            const validationErrors = error.errors.map(err => err.message).join(', ');
            return res.status(400).json({
                error: 'Validation failed',
                details: validationErrors
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                error: 'Username or email already exists'
            });
        }

        res.status(500).json({ error: 'Internal server error during signup' });
    }
});

// Check if user is logged in
app.get('/api/auth/check', (req, res) => {
    console.log('Auth check - session user:', req.session.user);
    console.log('Auth check - session ID:', req.sessionID);
    console.log('Auth check - session data:', req.session);
    if (req.session.user) {
        res.json({
            success: true,
            user: req.session.user
        });
    } else {
        res.json({
            success: false,
            user: null
        });
    }
});

// Logout route
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Test endpoint to see existing users
app.get('/api/test/users', async (req, res) => {
    try {
        if (!profileManager.isInitialized) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        
        // Get all users (this is a test endpoint)
        const users = await profileManager.getAllUsers();
        res.json({ users: users.map(u => ({ username: u.username, email: u.email })) });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Profile routes
app.get('/api/profile/:username', (req, res) => {
    const { username } = req.params;
    const profile = profileManager.profiles.find(p => p.username === username);

    if (profile) {
        res.json({
            username: profile.username,
            email: profile.email,
            joinDate: profile.joinDate,
            bio: profile.bio,
            gamingPreferences: profile.gamingPreferences,
            statistics: profile.statistics,
            achievements: profile.achievements
        });
    } else {
        res.status(404).json({ error: 'Profile not found' });
    }
});

app.put('/api/profile/:username', async (req, res) => {
    const { username } = req.params;
    const updates = req.body;

    if (!profileManager.isInitialized) {
        return res.status(503).json({ error: 'Database not ready yet, please try again' });
    }

    profileManager.loadProfile(username);
    const success = await profileManager.updateCurrentProfile(updates);

    if (success) {
        res.json({ success: true, message: 'Profile updated successfully' });
    } else {
        res.status(400).json({ error: 'Failed to update profile' });
    }
});

// Friends routes - Enhanced with database integration
app.get('/api/friends/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user from database
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get accepted friendships (friends)
        const friends = await profileManager.getFriendships(user.id, 'accepted');
        
        // Get pending requests (both sent and received)
        const sentRequests = await profileManager.getSentFriendRequests(user.id);
        const receivedRequests = await profileManager.getReceivedFriendRequests(user.id);

        res.json({
            success: true,
            friends: friends,
            sentRequests: sentRequests,
            receivedRequests: receivedRequests
        });
    } catch (error) {
        console.error('Error getting friends:', error);
        res.status(500).json({ error: 'Failed to get friends' });
    }
});

app.post('/api/friends/:username/request', async (req, res) => {
    try {
        const { username } = req.params;
        const { friendUsername } = req.body;

        if (!friendUsername) {
            return res.status(400).json({ error: 'Friend username is required' });
        }

        if (username === friendUsername) {
            return res.status(400).json({ error: 'Cannot send friend request to yourself' });
        }

        // Get both users
        const user = await profileManager.getUserByUsername(username);
        const friend = await profileManager.getUserByUsername(friendUsername);

        if (!user || !friend) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if friendship already exists
        const existingFriendship = await profileManager.getFriendship(user.id, friend.id);
        if (existingFriendship) {
            return res.status(400).json({ error: 'Friendship already exists or request already sent' });
        }

        // Create friend request
        const friendship = await profileManager.createFriendRequest(user.id, friend.id);
        
        res.json({
            success: true,
            message: 'Friend request sent successfully',
            friendship: friendship
        });
    } catch (error) {
        console.error('Error sending friend request:', error);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

app.post('/api/friends/:username/accept/:requestId', async (req, res) => {
    try {
        const { username, requestId } = req.params;
        
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const friendship = await profileManager.acceptFriendRequest(parseInt(requestId), user.id);
        
        if (friendship) {
            res.json({
                success: true,
                message: 'Friend request accepted',
                friendship: friendship
            });
        } else {
            res.status(400).json({ error: 'Friend request not found or already processed' });
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
        res.status(500).json({ error: 'Failed to accept friend request' });
    }
});

app.post('/api/friends/:username/decline/:requestId', async (req, res) => {
    try {
        const { username, requestId } = req.params;
        
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const success = await profileManager.declineFriendRequest(parseInt(requestId), user.id);
        
        if (success) {
            res.json({
                success: true,
                message: 'Friend request declined'
            });
        } else {
            res.status(400).json({ error: 'Friend request not found or already processed' });
        }
    } catch (error) {
        console.error('Error declining friend request:', error);
        res.status(500).json({ error: 'Failed to decline friend request' });
    }
});

app.delete('/api/friends/:username/remove/:friendId', async (req, res) => {
    try {
        const { username, friendId } = req.params;
        
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const success = await profileManager.removeFriend(user.id, parseInt(friendId));
        
        if (success) {
            res.json({
                success: true,
                message: 'Friend removed successfully'
            });
        } else {
            res.status(400).json({ error: 'Friendship not found' });
        }
    } catch (error) {
        console.error('Error removing friend:', error);
        res.status(500).json({ error: 'Failed to remove friend' });
    }
});

// Wishlist routes
app.get('/api/wishlists/:username', (req, res) => {
    const { username } = req.params;
    profileManager.loadProfile(username);
    const wishlistManager = profileManager.getWishlistManager();

    if (wishlistManager) {
        res.json({
            wishlists: wishlistManager.getWishlists()
        });
    } else {
        res.status(404).json({ error: 'Wishlist manager not found' });
    }
});

app.post('/api/wishlists/:username/create', (req, res) => {
    const { username } = req.params;
    const { name, description } = req.body;

    profileManager.loadProfile(username);
    const wishlistManager = profileManager.getWishlistManager();

    if (wishlistManager) {
        const wishlist = wishlistManager.createWishlist(name, description);
        res.json({ success: true, wishlist });
    } else {
        res.status(404).json({ error: 'Wishlist manager not found' });
    }
});

// Reviews routes
app.get('/api/reviews', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = req.session.user.id;
        const reviews = await Review.findAll({
            where: { userId: userId },
            order: [['createdAt', 'DESC']]
        });

        const averageRating = reviews.length > 0 
            ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
            : 0;

        res.json({
            success: true,
            reviews: reviews.map(review => ({
                id: review.id,
                gameTitle: review.gameTitle,
                rating: review.rating,
                reviewText: review.reviewText,
                tags: review.tags || [],
                helpfulVotes: review.helpfulVotes,
                isPublic: review.isPublic,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt
            })),
            averageRating: parseFloat(averageRating),
            totalReviews: reviews.length
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { gameTitle, rating, reviewText, tags, isPublic } = req.body;
        const userId = req.session.user.id;

        // Validate required fields
        if (!gameTitle || !rating || !reviewText) {
            return res.status(400).json({ error: 'Game title, rating, and review text are required' });
        }

        // Validate rating
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Validate review text length
        if (reviewText.length < 10 || reviewText.length > 5000) {
            return res.status(400).json({ error: 'Review text must be between 10 and 5000 characters' });
        }

        const review = await Review.create({
            userId: userId,
            gameTitle: gameTitle,
            rating: rating,
            reviewText: reviewText,
            tags: tags || [],
            isPublic: isPublic !== false, // Default to true
            helpfulVotes: 0
        });

        res.json({
            success: true,
            review: {
                id: review.id,
                gameTitle: review.gameTitle,
                rating: review.rating,
                reviewText: review.reviewText,
                tags: review.tags,
                helpfulVotes: review.helpfulVotes,
                isPublic: review.isPublic,
                createdAt: review.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({ error: 'Failed to create review' });
    }
});

app.put('/api/reviews/:reviewId', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { reviewId } = req.params;
        const { gameTitle, rating, reviewText, tags, isPublic } = req.body;
        const userId = req.session.user.id;

        const review = await Review.findOne({
            where: { id: reviewId, userId: userId }
        });

        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        // Validate required fields
        if (!gameTitle || !rating || !reviewText) {
            return res.status(400).json({ error: 'Game title, rating, and review text are required' });
        }

        // Validate rating
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Validate review text length
        if (reviewText.length < 10 || reviewText.length > 5000) {
            return res.status(400).json({ error: 'Review text must be between 10 and 5000 characters' });
        }

        await review.update({
            gameTitle: gameTitle,
            rating: rating,
            reviewText: reviewText,
            tags: tags || [],
            isPublic: isPublic !== false
        });

        res.json({
            success: true,
            review: {
                id: review.id,
                gameTitle: review.gameTitle,
                rating: review.rating,
                reviewText: review.reviewText,
                tags: review.tags,
                helpfulVotes: review.helpfulVotes,
                isPublic: review.isPublic,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({ error: 'Failed to update review' });
    }
});

app.delete('/api/reviews/:reviewId', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { reviewId } = req.params;
        const userId = req.session.user.id;

        const review = await Review.findOne({
            where: { id: reviewId, userId: userId }
        });

        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        await review.destroy();

        res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

// Admin routes
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    const admin = adminManager.adminLogin(username, password);
    if (admin) {
        res.json({ success: true, admin: { username: admin.username, permissions: admin.permissions } });
    } else {
        res.status(401).json({ error: 'Invalid admin credentials' });
    }
});

app.get('/api/admin/stats', (req, res) => {
    const stats = adminManager.getUserStatistics(profileManager);
    const logs = adminManager.getSystemLogs();

    res.json({
        userStats: stats,
        systemLogs: logs.slice(-20).reverse()
    });
});

// Game search routes
app.get('/api/games/search', async (req, res) => {
    const { q: query, page = 1, pageSize = 20 } = req.query;

    if (!query || query.trim().length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Search query is required' 
        });
    }

    try {
        const result = await gameSearchService.searchGames(query.trim(), parseInt(page), parseInt(pageSize));
        res.json(result);
    } catch (error) {
        console.error('Error in game search:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error during game search' 
        });
    }
});

// Game search suggestions endpoint
app.get('/api/games/suggestions', async (req, res) => {
    const { q: query, limit = 5 } = req.query;

    if (!query || query.trim().length < 2) {
        return res.json({ success: true, suggestions: [] });
    }

    try {
        const result = await gameSearchService.getSearchSuggestions(query.trim(), parseInt(limit));
        res.json(result);
    } catch (error) {
        console.error('Error getting search suggestions:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error during suggestions fetch' 
        });
    }
});

// Trending games endpoint
app.get('/api/games/trending', async (req, res) => {
    try {
        const result = await gameSearchService.getTrendingGames();
        res.json(result);
    } catch (error) {
        console.error('Error getting trending games:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch trending games' 
        });
    }
});

// Recent games endpoint
app.get('/api/games/recent', async (req, res) => {
    try {
        const result = await gameSearchService.getRecentGames();
        res.json(result);
    } catch (error) {
        console.error('Error getting recent games:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch recent games' 
        });
    }
});

app.get('/api/games/:gameId', async (req, res) => {
    const { gameId } = req.params;

    if (!gameId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Game ID is required' 
        });
    }

    try {
        const result = await gameSearchService.getGameDetails(gameId);
        res.json(result);
    } catch (error) {
        console.error('Error fetching game details:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error while fetching game details' 
        });
    }
});

// ===== Error Handling =====
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ===== Start Server =====
app.listen(PORT, async () => {
    console.log(`🎮 Game Vault Profile System running on http://localhost:${PORT}`);
    console.log(`📊 Admin panel available at http://localhost:${PORT}`);
    console.log(`✅ Server ready - create your own users!`);

    console.log('🔄 Waiting for database initialization...');
    const checkDatabase = setInterval(() => {
        if (profileManager.isInitialized) {
            clearInterval(checkDatabase);
            isDatabaseReady = true;
            console.log('✅ Database connection established!');
            console.log(`✅ Database ready for new users!`);
        }
    }, 100);

    setTimeout(() => {
        if (!isDatabaseReady) {
            clearInterval(checkDatabase);
            console.error('❌ Database initialization timeout. Server running with limited functionality.');
        }
    }, 10000);
});

module.exports = app;
