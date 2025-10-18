const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
app.get('/', (req, res) => {
    res.render('index', { trendingGames: [], recentGames: [] });
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
        res.json({
            success: true,
            user: {
                username: user.username,
                email: user.email,
                joinDate: user.joinDate,
                bio: user.bio,
                gamingPreferences: user.gamingPreferences,
                statistics: user.statistics,
                achievements: user.achievements
            }
        });
    } else {
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
            res.json({
                success: true,
                user: {
                    username: user.username,
                    email: user.email,
                    joinDate: user.joinDate,
                    bio: user.bio,
                    gamingPreferences: user.gamingPreferences,
                    statistics: user.statistics,
                    achievements: user.achievements
                }
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

// Friends routes
app.get('/api/friends/:username', (req, res) => {
    const { username } = req.params;
    profileManager.loadProfile(username);
    const friendsList = profileManager.getFriendsList();

    if (friendsList) {
        res.json({
            friends: friendsList.getFriendsList(),
            pendingRequests: friendsList.getPendingRequests()
        });
    } else {
        res.status(404).json({ error: 'Friends list not found' });
    }
});

app.post('/api/friends/:username/add', (req, res) => {
    const { username } = req.params;
    const { friendUsername } = req.body;

    profileManager.loadProfile(username);
    const friendsList = profileManager.getFriendsList();

    if (friendsList) {
        const success = friendsList.sendFriendRequest(`user_${Date.now()}`, friendUsername);
        res.json({ success, message: success ? 'Friend request sent' : 'Failed to send friend request' });
    } else {
        res.status(404).json({ error: 'Friends list not found' });
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
app.get('/api/reviews/:username', (req, res) => {
    const { username } = req.params;
    profileManager.loadProfile(username);
    const reviewManager = profileManager.getReviewManager();

    if (reviewManager) {
        res.json({
            reviews: reviewManager.getReviews(),
            averageRating: reviewManager.getAverageRating()
        });
    } else {
        res.status(404).json({ error: 'Review manager not found' });
    }
});

app.post('/api/reviews/:username/add', (req, res) => {
    const { username } = req.params;
    const { gameTitle, rating, reviewText, tags } = req.body;

    profileManager.loadProfile(username);
    const reviewManager = profileManager.getReviewManager();

    if (reviewManager) {
        const review = reviewManager.addReview(`game_${Date.now()}`, gameTitle, rating, reviewText, tags);
        res.json({ success: true, review });
    } else {
        res.status(404).json({ error: 'Review manager not found' });
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
