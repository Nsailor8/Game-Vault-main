const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Import the profile system classes
const { 
    UserProfile, 
    ProfileManager, 
    FriendsList, 
    WishlistManager, 
    ReviewManager, 
    AdminManager, 
    DatabaseManager 
} = require('./profile.js');

// Initialize managers
const profileManager = new ProfileManager();
const adminManager = new AdminManager();

// Load sample data
function loadSampleData() {
    // Create sample admin
    adminManager.createAdmin('admin', 'admin@gamevault.com', 'admin123');
    
    // Create sample users
    profileManager.signUp('GameMaster2024', 'gamemaster@example.com', 'password123', {
        favoriteGenres: ['RPG', 'Action', 'Indie'],
        preferredPlatforms: ['Steam', 'Nintendo'],
        playStyle: 'hardcore',
        gamingGoals: ['Complete all achievements', 'Try new genres']
    });

    profileManager.signUp('CasualGamer', 'casual@example.com', 'password456', {
        favoriteGenres: ['Puzzle', 'Platformer'],
        preferredPlatforms: ['Nintendo'],
        playStyle: 'casual',
        gamingGoals: ['Have fun', 'Relax after work']
    });

    // Add some sample achievements
    profileManager.login('GameMaster2024', 'password123');
    profileManager.addAchievementToCurrentProfile({
        name: 'First Steps',
        description: 'Created your first profile',
        rarity: 'common'
    });

    profileManager.addAchievementToCurrentProfile({
        name: 'Collection Starter',
        description: 'Added your first game to the library',
        rarity: 'common'
    });

    // Add sample friends
    const friendsList = profileManager.getFriendsList();
    if (friendsList) {
        friendsList.addFriend('user2', 'GamerFriend');
        friendsList.sendFriendRequest('user3', 'BestGamer');
    }

    // Add sample wishlist
    const wishlistManager = profileManager.getWishlistManager();
    if (wishlistManager) {
        wishlistManager.createWishlist('Must Play Games', 'Games I really want to play');
        wishlistManager.addGameToWishlist(1, { id: 1, title: 'Cyberpunk 2077', platform: 'Steam' });
        wishlistManager.addGameToWishlist(1, { id: 2, title: 'Baldur\'s Gate 3', platform: 'Steam' });
    }

    // Add sample reviews
    const reviewManager = profileManager.getReviewManager();
    if (reviewManager) {
        reviewManager.addReview(1, 'The Witcher 3', 5, 'Amazing RPG with incredible storytelling and world-building!', ['RPG', 'Fantasy', 'Open World']);
        reviewManager.addReview(2, 'Hades', 4, 'Great roguelike with fantastic art and music.', ['Roguelike', 'Action', 'Indie']);
    }
}

// API Routes

// Authentication routes
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = profileManager.login(username, password);
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

app.post('/api/auth/signup', (req, res) => {
    const { username, email, password, gamingPreferences } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const user = profileManager.signUp(username, email, password, gamingPreferences || {});
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

app.put('/api/profile/:username', (req, res) => {
    const { username } = req.params;
    const updates = req.body;
    
    profileManager.loadProfile(username);
    const success = profileManager.updateCurrentProfile(updates);
    
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

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎮 Game Vault Profile System running on http://localhost:${PORT}`);
    console.log(`📊 Admin panel available at http://localhost:${PORT}`);
    console.log(`🔑 Sample admin credentials: admin / admin123`);
    console.log(`👤 Sample user credentials: GameMaster2024 / password123`);
    
    // Load sample data
    loadSampleData();
    console.log(`✅ Sample data loaded successfully!`);
});

module.exports = app;
