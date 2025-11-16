// Handle unhandled promise rejections to prevent crashes
process.on('unhandledRejection', (error, promise) => {
    console.error('❌ Unhandled Promise Rejection:', error.message);
    if (error.stack) {
        console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    console.error('   This error was caught to prevent server crash');
    // Don't exit - let the server continue running
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    console.error('   Stack:', error.stack);
    // Don't exit - let the server continue running
});

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();
const GameSearchService = require('./server/services/GameSearchService');
const SteamService = require('./server/services/SteamService');

// Load database models once at startup
const { User, Game, Review, Wishlist, WishlistGame, Friendship, Achievement, ReviewHelpfulVote, Post, Comment } = require('./server/models/index');
const { sequelize } = require('./server/config/database');
const { Op, QueryTypes } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session store configuration
let sessionStore = null;
try {
    // Try to use memory store (default) - sessions persist within server process
    const MemoryStore = require('express-session').MemoryStore;
    sessionStore = new MemoryStore();
} catch (error) {
    console.log('Using default session store');
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'game-vault-secret-key',
    resave: true,
    saveUninitialized: true, // Allow saving sessions for Steam OAuth flow
    rolling: true, // Reset expiration on activity - keep session alive
    store: sessionStore, // Use memory store if available
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days - keep signed in longer
        httpOnly: true, // Prevent client-side access to cookies
        sameSite: 'lax', // CSRF protection - allow cookies during Steam OAuth redirect
        domain: undefined, // Allow cookies for localhost
        path: '/' // Ensure cookie is available for all paths
    },
    name: 'connect.sid' // Default session cookie name
}));

// Log session configuration
console.log('[Session Config] Session store:', sessionStore ? 'MemoryStore' : 'default');
console.log('[Session Config] Cookie name: connect.sid');
console.log('[Session Config] Cookie maxAge: 7 days');
console.log('[Session Config] Cookie sameSite: lax');
console.log('[Session Config] Cookie httpOnly: true');
console.log('[Session Config] Cookie path: /');
console.log('[Session Config] Cookie domain: undefined (allows localhost)');

// Helper function to restore session user from database
async function restoreSessionUser(req, username = null) {
    // If session user exists, return it
    if (req.session?.user) {
        return req.session.user;
    }
    
    // If no session, can't restore
    if (!req.session || !req.sessionID) {
        return null;
    }
    
    // Try to reload session first
    try {
        await new Promise((resolve, reject) => {
            req.session.reload((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        if (req.session?.user) {
            console.log('[Restore Session] Session reloaded, found user:', req.session.user.username);
            return req.session.user;
        }
    } catch (error) {
        console.log('[Restore Session] Session reload failed:', error.message);
    }
    
    // If we have a username (from URL or request), try to restore from database
    if (username) {
        try {
            const dbUser = await User.findOne({ where: { username: username } });
            if (dbUser) {
                console.log('[Restore Session] Restoring session user from database:', username);
                
                // Extract user_id using multiple methods
                let userId = dbUser.user_id || dbUser.getDataValue?.('user_id') || dbUser.dataValues?.user_id || dbUser.id;
                
                req.session.user = {
                    id: userId,  // Store as 'id' for consistency
                    user_id: userId,  // Also store as 'user_id' for compatibility
                    username: dbUser.username || dbUser.getDataValue?.('username') || dbUser.dataValues?.username,
                    email: dbUser.email || dbUser.getDataValue?.('email') || dbUser.dataValues?.email,
                    joinDate: dbUser.join_date || dbUser.getDataValue?.('join_date') || dbUser.dataValues?.join_date,
                    bio: dbUser.bio || dbUser.getDataValue?.('bio') || dbUser.dataValues?.bio || '',
                    gamingPreferences: dbUser.gaming_preferences || dbUser.getDataValue?.('gaming_preferences') || dbUser.dataValues?.gaming_preferences || {},
                    statistics: dbUser.statistics || dbUser.getDataValue?.('statistics') || dbUser.dataValues?.statistics || {},
                    achievements: dbUser.achievements || dbUser.getDataValue?.('achievements') || dbUser.dataValues?.achievements || [],
                    steam_id: dbUser.steam_id || dbUser.getDataValue?.('steam_id') || dbUser.dataValues?.steam_id,
                    steam_profile: dbUser.steam_profile || dbUser.getDataValue?.('steam_profile') || dbUser.dataValues?.steam_profile,
                    steam_games: dbUser.steam_games || dbUser.getDataValue?.('steam_games') || dbUser.dataValues?.steam_games,
                    steam_last_sync: dbUser.steam_last_sync || dbUser.getDataValue?.('steam_last_sync') || dbUser.dataValues?.steam_last_sync,
                    avatar_path: dbUser.avatar_path || dbUser.getDataValue?.('avatar_path') || dbUser.dataValues?.avatar_path
                };
                
                // Save the restored session
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                console.log('[Restore Session] Session restored with user_id:', userId);
                return req.session.user;
            }
        } catch (error) {
            console.error('[Restore Session] Error restoring from database:', error);
        }
    }
    
    return null;
}

// Middleware to check if user is authenticated (with session restoration)
async function isAuthenticated(req, res, next) {
    // Try to restore session if missing
    if (!req.session?.user && req.session && req.sessionID) {
        // Try to get username from URL
        const pathMatch = req.path.match(/\/api\/(?:friends|wishlists|reviews|profile)\/([^\/]+)/);
        const username = pathMatch ? pathMatch[1] : null;
        
        const restoredUser = await restoreSessionUser(req, username);
        if (restoredUser) {
            console.log('[Is Authenticated] Session restored:', restoredUser.username);
        }
    }
    
    if (req.session && req.session.user) {
        // Refresh session expiry on activity
        req.session.touch();
    next();
    } else {
        res.status(401).json({ success: false, error: 'Not authenticated' });
    }
}

app.use(async (req, res, next) => {
    // Touch session to keep it alive on every request
    if (req.session) {
        req.session.touch();
        
        // If session exists but user is missing, try to restore it from database
        // This handles cases where the session store lost the user data (e.g., server restart)
        if (!req.session.user && req.sessionID) {
            let username = null;
            
            // Try to get username from URL path (various patterns)
            const pathMatch = req.path.match(/\/(?:api\/)?(?:profile|friends|wishlists|reviews)\/([^\/]+)/);
            if (pathMatch && pathMatch[1]) {
                username = pathMatch[1];
            }
            
            // If we have a username, try to restore from database
            if (username) {
                try {
                    const dbUser = await User.findOne({ where: { username: username } });
                    if (dbUser) {
                        console.log('[Session Middleware] Restoring session user from database:', username);
                        req.session.user = {
                            id: dbUser.id,
                            username: dbUser.username,
                            email: dbUser.email,
                            joinDate: dbUser.join_date,
                            bio: dbUser.bio,
                            gamingPreferences: dbUser.gaming_preferences || {},
                            statistics: dbUser.statistics || {},
                            achievements: dbUser.achievements || [],
                            steam_id: dbUser.steam_id,
                            steam_profile: dbUser.steam_profile,
                            steam_games: dbUser.steam_games,
                            steam_last_sync: dbUser.steam_last_sync,
                            avatar_path: dbUser.avatar_path
                        };
                        req.session.save();
                    }
                } catch (error) {
                    // Silently fail - don't block the request
                    console.warn('[Session Middleware] Could not restore session user:', error.message);
                }
            }
        }
    }
    
    // Only log session info for API requests to reduce noise
    if (req.path.startsWith('/api/')) {
        console.log('[Session Middleware]', {
            path: req.path,
            sessionID: req.sessionID,
            hasSession: !!req.session,
            hasUser: !!req.session?.user,
            username: req.session?.user?.username || 'none',
            cookie: req.headers.cookie ? 'present' : 'missing'
        });
    }
    
    next();
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: username-timestamp.extension
        const username = req.session.user?.username || 'user';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${username}-${timestamp}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Serve static assets (CSS, JS, images) from 'public' folder
// Disable caching in development to see changes immediately
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.ejs')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './client/views'));

const {
    UserProfile,
    ProfileManager,
    FriendsList,
    WishlistManager,
    ReviewManager,
    AdminManager
} = require('./client/profile.js');

const profileManager = new ProfileManager();
// AdminManager will use the same databaseManager instance from ProfileManager
const adminManager = new AdminManager(profileManager.databaseManager);
const gameSearchService = new GameSearchService();
const steamService = new SteamService();

app.use(passport.initialize());
app.use(passport.session());

// Steam OAuth Configuration
const steamReturnURL = process.env.STEAM_RETURN_URL || 'http://localhost:3000/api/auth/steam/return';
const steamRealm = process.env.STEAM_REALM || 'http://localhost:3000';

console.log('[Steam Strategy] Configuring Steam OAuth:');
console.log('[Steam Strategy] Return URL:', steamReturnURL);
console.log('[Steam Strategy] Realm:', steamRealm);

passport.use(new SteamStrategy({
    returnURL: steamReturnURL,
    realm: steamRealm,
    apiKey: process.env.STEAM_API_KEY || 'your-steam-api-key-here'
}, async (identifier, profile, done) => {
    try {
        console.log('[Steam OAuth] ==========================================');
        console.log('[Steam OAuth] Processing Steam authentication...');
        console.log('[Steam OAuth] Identifier:', identifier);
        console.log('[Steam OAuth] Profile:', profile ? {
            displayName: profile.displayName,
            id: profile.id,
            hasPhotos: !!profile.photos,
            hasJson: !!profile._json,
            profileKeys: profile ? Object.keys(profile) : []
        } : 'null');
        
        if (!identifier) {
            console.error('[Steam OAuth] No identifier provided');
            return done(new Error('Invalid Steam identifier - no identifier provided'), null);
        }
        
        const steamId = identifier.split('/').pop();
        
        if (!steamId || !steamId.match(/^\d+$/)) {
            console.error('[Steam OAuth] Could not extract valid Steam ID from identifier:', identifier);
            return done(new Error('Invalid Steam identifier - could not extract Steam ID'), null);
        }
        
        console.log('[Steam OAuth] Extracted Steam ID:', steamId);
        
        const userData = {
            steamId: steamId,
            profile: {
                id: steamId,
                username: profile?.displayName || profile?.username || 'Steam User',
                displayName: profile?.displayName || profile?.username || 'Steam User',
                photos: profile?.photos || [],
                profileUrl: profile?._json?.profileurl || profile?.profileUrl || `https://steamcommunity.com/profiles/${steamId}`
            }
        };
        
        console.log('[Steam OAuth] Created user data:', {
            steamId: userData.steamId,
            username: userData.profile.username,
            hasPhotos: userData.profile.photos.length > 0,
            profileUrl: userData.profile.profileUrl
        });
        console.log('[Steam OAuth] ==========================================');
        
        return done(null, userData);
    } catch (error) {
        console.error('[Steam OAuth] ==========================================');
        console.error('[Steam OAuth] Error in Steam strategy:', error);
        console.error('[Steam OAuth] Error message:', error.message);
        console.error('[Steam OAuth] Error stack:', error.stack);
        console.error('[Steam OAuth] ==========================================');
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

let isDatabaseReady = false;

app.use((req, res, next) => {
    res.locals.homeLink = '/';
    res.locals.profileLink = '/profile';
    res.locals.friendsLink = '/friends';

    const pathName = req.path;
    if (pathName.startsWith('/profile')) res.locals.activePage = 'profile';
    else if (pathName.startsWith('/friends')) res.locals.activePage = 'friends';
    else if (pathName.startsWith('/library')) res.locals.activePage = 'library';
    else if (pathName.startsWith('/wishlist')) res.locals.activePage = 'wishlist';
    else if (pathName.startsWith('/reviews')) res.locals.activePage = 'reviews';
    else if (pathName.startsWith('/settings')) res.locals.activePage = 'settings';
    else if (pathName.startsWith('/admin')) res.locals.activePage = 'admin';
    else res.locals.activePage = 'home';

    next();
});

// ===== Render EJS Views =====
app.get('/', async (req, res) => {
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    // Render page immediately with empty arrays - games will load asynchronously via API
        res.render('index', { 
        trendingGames: [], 
        recentGames: [],
        user: req.session.user || null
    });
});

// Settings page
app.get('/settings', (req, res) => {
    console.log('[Settings Route] Session user:', req.session.user ? req.session.user.username : 'none');
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    res.render('settings', {
        activePage: 'settings',
        user: req.session.user || null
    });
});

// User-specific profile routes
app.get('/profile/:username', async (req, res) => {
    const { username } = req.params;
    let profile;

    try {
        console.log('[Profile Route] Loading profile for username:', username);
        console.log('[Profile Route] Session ID:', req.sessionID);
        console.log('[Profile Route] Session user:', req.session.user ? req.session.user.username : 'none');
        console.log('[Profile Route] Cookies:', req.headers.cookie);
        
        // Ensure session is saved/touched to maintain it
        if (req.session) {
            req.session.touch();
            // Save session to persist it
            req.session.save((err) => {
                if (err) {
                    console.error('[Profile Route] Error saving session:', err);
                }
            });
        }
        
        // Load user data directly from database to avoid caching issues
        const dbUser = await User.findOne({ where: { username } });
        
        if (dbUser) {
            // Extract values using multiple methods to ensure we get the data
            let usernameValue = dbUser.username || dbUser.getDataValue?.('username') || dbUser.dataValues?.username;
            
            // If username is still not found, use the URL parameter as fallback
            if (!usernameValue || usernameValue === 'undefined' || usernameValue === 'null') {
                console.warn('[Profile Route] Username not found in database, using URL parameter:', username);
                usernameValue = username;
            }
            
            const emailValue = dbUser.email || dbUser.getDataValue?.('email') || dbUser.dataValues?.email || '';
            const steamIdValue = dbUser.steam_id || dbUser.getDataValue?.('steam_id') || dbUser.dataValues?.steam_id || null;
            const steamProfileValue = dbUser.steam_profile || dbUser.getDataValue?.('steam_profile') || dbUser.dataValues?.steam_profile || null;
            
            console.log('User found in database:', usernameValue);
            console.log('User Steam ID from database:', steamIdValue);
            console.log('User Steam profile from database:', steamProfileValue ? 'present' : 'missing');
            console.log('Final username value being used:', usernameValue);
            
            // Use statistics from database if available, otherwise calculate from Steam games
            let totalGames = 0;
            let totalPlaytime = 0;
            let achievementCount = 0;
            let avgRating = 0;
            let steamLinked = false;
            let steamGames = null; // Will be used for profile.steam_games
            
            if (steamIdValue) {
                steamLinked = true;
                console.log('User has Steam account linked:', steamIdValue);
                
                // Always calculate from steam_games if available, as it's more accurate
                // Ensure steam_games is an array (JSONB might need parsing)
                // Try multiple methods to extract steam_games from Sequelize instance
                steamGames = dbUser.steam_games || dbUser.getDataValue?.('steam_games') || dbUser.dataValues?.steam_games || null;
                
                console.log('[Profile] Steam games extraction:', {
                    direct: dbUser.steam_games ? 'found' : 'not found',
                    getDataValue: dbUser.getDataValue ? (dbUser.getDataValue('steam_games') ? 'found' : 'not found') : 'N/A',
                    dataValues: dbUser.dataValues ? (dbUser.dataValues.steam_games ? 'found' : 'not found') : 'N/A',
                    final: steamGames ? (Array.isArray(steamGames) ? `array with ${steamGames.length} items` : typeof steamGames) : 'null'
                });
                
                if (steamGames && !Array.isArray(steamGames)) {
                    try {
                        if (typeof steamGames === 'string') {
                            steamGames = JSON.parse(steamGames);
                        } else if (steamGames && typeof steamGames === 'object') {
                            // Try to convert object to array if it's not already
                            steamGames = Array.isArray(steamGames) ? steamGames : null;
                        }
                    } catch (e) {
                        console.error('[Profile] Error parsing steam_games:', e);
                        steamGames = null;
                    }
                }
                
                console.log('[Profile] After parsing - steamGames:', steamGames ? (Array.isArray(steamGames) ? `array with ${steamGames.length} items` : typeof steamGames) : 'null');
                
                // Always try to calculate from steam_games first
                if (steamGames && Array.isArray(steamGames) && steamGames.length > 0) {
                    totalGames = steamGames.length;
                    totalPlaytime = steamGames.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
                    achievementCount = steamGames.reduce((sum, game) => sum + (game.achievements || 0), 0);
                    totalPlaytime = Math.round(totalPlaytime / 60); // Convert to hours
                    
                    // Calculate average rating from game ratings if available
                    const gamesWithRatings = steamGames.filter(game => game.rating && game.rating > 0);
                    if (gamesWithRatings.length > 0) {
                        avgRating = (gamesWithRatings.reduce((sum, game) => sum + game.rating, 0) / gamesWithRatings.length).toFixed(1);
                    } else if (dbUser.statistics && dbUser.statistics.averageRating) {
                        // Fallback to database statistics if no game ratings available
                        avgRating = dbUser.statistics.averageRating;
                    }
                    
                    console.log('Statistics calculated from Steam games:', { 
                        totalGames, 
                        totalPlaytime, 
                        achievementCount,
                        avgRating,
                        gamesArrayLength: steamGames.length,
                        gamesWithRatings: gamesWithRatings.length
                    });
                } 
                
                // Always prefer database statistics if available (they're more accurate after sync)
                // Database statistics are updated during sync and include all games, not just the first batch
                if (dbUser.statistics) {
                    const dbStats = dbUser.statistics;
                    // Use database stats if they exist (they're calculated during sync)
                    if (dbStats.totalGamesPlayed !== undefined && dbStats.totalGamesPlayed > 0) {
                        totalGames = dbStats.totalGamesPlayed;
                        console.log('Using totalGames from database statistics:', totalGames);
                    }
                    if (dbStats.totalPlaytime !== undefined && dbStats.totalPlaytime > 0) {
                        totalPlaytime = dbStats.totalPlaytime;
                        console.log('Using totalPlaytime from database statistics:', totalPlaytime);
                    }
                    if (dbStats.totalAchievements !== undefined && dbStats.totalAchievements > 0) {
                        achievementCount = dbStats.totalAchievements;
                        console.log('Using totalAchievements from database statistics:', achievementCount);
                    }
                    if (dbStats.averageRating !== undefined && dbStats.averageRating > 0) {
                        avgRating = dbStats.averageRating;
                        console.log('Using averageRating from database statistics:', avgRating);
                    }
                    
                    console.log('Final statistics from database:', { 
                        totalGames, 
                        totalPlaytime, 
                        achievementCount,
                        avgRating
                    });
                }
                
                if (totalGames === 0) {
                    console.log('No Steam games or statistics found for user:', usernameValue);
                    console.log('steam_games value:', dbUser.steam_games);
                    console.log('steam_games type:', typeof dbUser.steam_games, 'isArray:', Array.isArray(dbUser.steam_games));
                    console.log('statistics value:', dbUser.statistics);
                }
            } else {
                console.log('No Steam account linked for user:', usernameValue);
            }
            
            // Calculate average rating from user's reviews
            try {
                const userId = dbUser.user_id || dbUser.getDataValue?.('user_id') || dbUser.dataValues?.user_id || dbUser.id;
                if (userId) {
                    const userReviews = await Review.findAll({
                        where: { userId: userId },
                        attributes: ['rating']
                    });
                    
                    if (userReviews && userReviews.length > 0) {
                        const ratingsSum = userReviews.reduce((sum, review) => {
                            const rating = parseFloat(review.rating || review.getDataValue?.('rating') || review.dataValues?.rating || 0);
                            return sum + rating;
                        }, 0);
                        avgRating = (ratingsSum / userReviews.length).toFixed(1);
                        console.log('[Profile] Calculated avgRating from reviews:', avgRating, 'from', userReviews.length, 'reviews');
                    } else {
                        console.log('[Profile] No reviews found for user, keeping avgRating from Steam/statistics:', avgRating);
                    }
                }
            } catch (reviewError) {
                console.error('[Profile] Error calculating avgRating from reviews:', reviewError);
                // Keep the existing avgRating from Steam/statistics if review calculation fails
            }
            
            // Extract additional fields with fallbacks
            const joinDateValue = dbUser.join_date || dbUser.getDataValue?.('join_date') || dbUser.dataValues?.join_date || null;
            const bioValue = dbUser.bio || dbUser.getDataValue?.('bio') || dbUser.dataValues?.bio || '';
            const gamingPrefs = dbUser.gaming_preferences || dbUser.getDataValue?.('gaming_preferences') || dbUser.dataValues?.gaming_preferences || {};
            const avatarPathValue = dbUser.avatar_path || dbUser.getDataValue?.('avatar_path') || dbUser.dataValues?.avatar_path || null;
            const steamLastSyncValue = dbUser.steam_last_sync || dbUser.getDataValue?.('steam_last_sync') || dbUser.dataValues?.steam_last_sync || null;
            
            // Convert database format to profile format
            profile = {
                username: usernameValue,
                email: emailValue,
                joinDate: joinDateValue,
                totalGames: totalGames,
                totalPlaytime: totalPlaytime,
                avgRating: parseFloat(avgRating) || 0,
                achievementCount: achievementCount,
                bio: bioValue,
                playStyle: gamingPrefs?.playStyle || '',
                favoriteGenres: gamingPrefs?.favoriteGenres || [],
                preferredPlatforms: gamingPrefs?.preferredPlatforms || [],
                achievements: [], // Achievements are stored separately in the achievements table
                steamLinked: steamLinked,
                steam_id: steamIdValue,
                steam_profile: steamProfileValue,
                steam_games: (steamGames && Array.isArray(steamGames)) ? steamGames : [], // Ensure it's always an array
                steam_last_sync: steamLastSyncValue,
                avatar_path: avatarPathValue, // Will use placeholder if null
                isCurrentUser: req.session.user && (req.session.user.username === username || req.session.user.username === usernameValue)
            };
            
            // Ensure statistics are always numbers, not undefined
            if (typeof profile.totalGames === 'undefined' || profile.totalGames === null) profile.totalGames = 0;
            if (typeof profile.totalPlaytime === 'undefined' || profile.totalPlaytime === null) profile.totalPlaytime = 0;
            if (typeof profile.avgRating === 'undefined' || profile.avgRating === null || isNaN(profile.avgRating)) profile.avgRating = 0;
            
            console.log('Profile prepared - steamLinked:', profile.steamLinked, 'steam_id:', profile.steam_id);
            console.log('Profile statistics - totalGames:', profile.totalGames, 'totalPlaytime:', profile.totalPlaytime, 'avgRating:', profile.avgRating);
            console.log('Profile steam_games count:', profile.steam_games ? profile.steam_games.length : 0);
        } else {
            console.log('User not found in database, checking session data');
            
            if (req.session.user && req.session.user.username === username) {
                console.log('Using session data as fallback for user:', username);
                
                let totalGames = 0;
                let totalPlaytime = 0;
                let achievementCount = 0;
                let avgRating = 0;
                
                if (req.session.user.steam_games && req.session.user.steam_games.length > 0) {
                    totalGames = req.session.user.steam_games.length;
                    totalPlaytime = req.session.user.steam_games.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
                    achievementCount = req.session.user.steam_games.reduce((sum, game) => sum + (game.achievements || 0), 0);
                    
                    // Calculate average rating from game ratings if available
                    const gamesWithRatings = req.session.user.steam_games.filter(game => game.rating && game.rating > 0);
                    if (gamesWithRatings.length > 0) {
                        avgRating = (gamesWithRatings.reduce((sum, game) => sum + game.rating, 0) / gamesWithRatings.length).toFixed(1);
                    }
                }
                
                // Calculate average rating from user's reviews (session fallback)
                try {
                    const userId = req.session.user.id || req.session.user.user_id;
                    if (userId) {
                        const userReviews = await Review.findAll({
                            where: { userId: userId },
                            attributes: ['rating']
                        });
                        
                        if (userReviews && userReviews.length > 0) {
                            const ratingsSum = userReviews.reduce((sum, review) => {
                                const rating = parseFloat(review.rating || review.getDataValue?.('rating') || review.dataValues?.rating || 0);
                                return sum + rating;
                            }, 0);
                            avgRating = (ratingsSum / userReviews.length).toFixed(1);
                            console.log('[Profile Session Fallback] Calculated avgRating from reviews:', avgRating, 'from', userReviews.length, 'reviews');
                        }
                    }
                } catch (reviewError) {
                    console.error('[Profile Session Fallback] Error calculating avgRating from reviews:', reviewError);
                }

                profile = {
                    username: req.session.user.username,
                    email: req.session.user.email || '',
                    joinDate: req.session.user.joinDate || '',
                    totalGames: totalGames,
                    totalPlaytime: Math.round(totalPlaytime / 60),
                    avgRating: parseFloat(avgRating) || 0,
                    achievementCount: achievementCount,
                    bio: req.session.user.bio || '',
                    playStyle: req.session.user.gamingPreferences?.playStyle || '',
                    favoriteGenres: req.session.user.gamingPreferences?.favoriteGenres || [],
                    preferredPlatforms: req.session.user.gamingPreferences?.preferredPlatforms || [],
                    achievements: req.session.user.achievements || [],
                    steamLinked: !!req.session.user.steam_id,
                    steam_id: req.session.user.steam_id,
                    steam_profile: req.session.user.steam_profile,
                    steam_games: req.session.user.steam_games,
                    steam_last_sync: req.session.user.steam_last_sync,
                    avatar_path: req.session.user.avatar_path || null,
                    isCurrentUser: true
                };
            } else {
                console.log('User not found and not current user');
                
                profile = {
                    username: username,
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
                    achievements: [],
                    steamLinked: false,
                    steam_id: null,
                    steam_profile: null,
                    steam_games: null,
                    steam_last_sync: null,
                    isCurrentUser: false
                };
            }
        }

        console.log('Profile data prepared:', {
            username: profile.username,
            email: profile.email,
            steamLinked: profile.steamLinked,
            totalGames: profile.totalGames,
            totalPlaytime: profile.totalPlaytime,
            achievementCount: profile.achievementCount
        });
        
        // Ensure username is always set - try session first, then URL parameter
        if (!profile.username || profile.username === 'undefined' || profile.username === 'null') {
            // Try to get from session first
            if (req.session.user && req.session.user.username) {
                console.warn('[Profile Route] Profile username is missing, using session username:', req.session.user.username);
                profile.username = req.session.user.username;
            } else {
                console.warn('[Profile Route] Profile username is missing, using URL parameter:', username);
                profile.username = username;
            }
        }
        
        // Also ensure email is set from session if missing
        if ((!profile.email || profile.email === 'Loading...') && req.session.user && req.session.user.email) {
            profile.email = req.session.user.email;
        }

        res.render('profile', { profile });
    } catch (error) {
        console.error('Error loading user profile:', error);
        res.status(500).render('profile', { 
            profile: {
                username: username,
                error: 'Failed to load profile',
                steamLinked: false,
                isCurrentUser: false
            }
        });
    }
});

app.get('/profile', async (req, res) => {
    try {
        console.log('[Profile Route] /profile accessed');
        console.log('[Profile Route] Session user:', req.session.user ? req.session.user.username : 'none');
        console.log('[Profile Route] Session ID:', req.sessionID);
        
        // Touch session to keep it alive
        req.session.touch();
        
        // Try to get username from session
        let username = null;
    if (req.session.user && req.session.user.username) {
            username = req.session.user.username;
            console.log('[Profile Route] Found username in session:', username);
            return res.redirect(`/profile/${username}`);
        }
        
        // If no session user, try to get from query parameter (for redirects)
        if (req.query.username) {
            username = req.query.username;
            console.log('[Profile Route] Found username in query:', username);
            return res.redirect(`/profile/${username}`);
        }
        
        // If still no username, redirect to home
        console.log('[Profile Route] No username found, redirecting to home');
        res.redirect('/');
    } catch (error) {
        console.error('[Profile Route] Error in /profile route:', error);
        res.redirect('/');
    }
});

app.get('/search', (req, res) => {
    console.log('[Search Route] Search route hit with query:', req.query.q);
    console.log('[Search Route] Session user:', req.session.user ? req.session.user.username : 'none');
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    res.render('search', {
        activePage: 'search',
        user: req.session.user || null
    });
});

app.get('/friends', (req, res) => {
    console.log('[Friends Route] Session user:', req.session.user ? req.session.user.username : 'none');
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    res.render('friends', {
        activePage: 'friends',
        user: req.session.user || null
    });
});

app.get('/library', (req, res) => {
    console.log('[Library Route] Session user:', req.session.user ? req.session.user.username : 'none');
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    res.render('library', {
        activePage: 'library',
        user: req.session.user || null
    });
});

app.get('/wishlist', (req, res) => {
    console.log('[Wishlist Route] Session user:', req.session.user ? req.session.user.username : 'none');
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    res.render('wishlist', {
        activePage: 'wishlist',
        user: req.session.user || null
    });
});

app.get('/reviews', (req, res) => {
    console.log('[Reviews Route] Session user:', req.session.user ? req.session.user.username : 'none');
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    res.render('reviews', {
        activePage: 'reviews',
        user: req.session.user || null
    });
});

app.get('/admin', (req, res) => {
    console.log('[Admin Route] Session user:', req.session.user ? req.session.user.username : 'none');
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    res.render('admin', {
        activePage: 'admin',
        user: req.session.user || null
    });
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!profileManager.isInitialized) {
        return res.status(503).json({ error: 'Database not ready yet, please try again' });
    }

    try {
        const user = await profileManager.login(username, password);
        if (user) {
            // Load full user data from database to ensure we have all fields
            const dbUser = await User.findOne({ where: { username: username } });
            
            // Extract user_id using multiple methods (primary key is user_id, not id)
            const userId = dbUser ? (dbUser.user_id || dbUser.getDataValue?.('user_id') || dbUser.dataValues?.user_id || dbUser.id) : null;
            
            // Store complete user data in session
            // Include both id and user_id for compatibility
            req.session.user = {
                id: userId,  // Store as 'id' for consistency
                user_id: userId,  // Also store as 'user_id' for compatibility
                username: user.username,
                email: user.email,
                joinDate: user.joinDate || (dbUser ? dbUser.join_date : null),
                bio: user.bio || (dbUser ? dbUser.bio : ''),
                gamingPreferences: user.gamingPreferences || (dbUser ? dbUser.gaming_preferences : {}),
                statistics: user.statistics || (dbUser ? dbUser.statistics : {}),
                achievements: user.achievements || [],
                steam_id: user.steam_id || (dbUser ? dbUser.steam_id : null),
                steam_profile: user.steam_profile || (dbUser ? dbUser.steam_profile : null),
                steam_games: user.steam_games || (dbUser ? dbUser.steam_games : null),
                steam_last_sync: user.steam_last_sync || (dbUser ? dbUser.steam_last_sync : null),
                avatar_path: user.avatar_path || (dbUser ? dbUser.avatar_path : null)
            };
            
            console.log('Login successful, session user set:', {
                username: req.session.user.username,
                email: req.session.user.email,
                steam_id: req.session.user.steam_id
            });
            console.log('Session ID:', req.sessionID);
            
            // Mark session as modified and save
            req.session.touch();
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Session save failed' });
                }
                
                console.log('Session saved successfully, cookie will be set');
                // Set cookie explicitly to ensure it's sent with longer expiration
                res.cookie('connect.sid', req.sessionID, {
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                    httpOnly: true,
                    sameSite: 'lax',
                    path: '/',
                    domain: undefined // Allow localhost
                });
                
                // Also set a non-httpOnly cookie for client-side detection
                res.cookie('sessionActive', 'true', {
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                    httpOnly: false, // Allow client-side access
                    sameSite: 'lax',
                    path: '/',
                    domain: undefined
                });
                
                // Store username in cookie for session restoration
                res.cookie('currentUsername', user.username, {
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                    httpOnly: false, // Allow client-side access if needed
                    sameSite: 'lax',
                    path: '/',
                    domain: undefined
                });
                
                console.log('[Login] Session cookie set:', req.sessionID);
                
                res.json({
                    success: true,
                    user: req.session.user
                });
            });
        } else {
            console.log('Login failed for username:', username);
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
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

            // Get user ID from database
            const dbUser = await User.findOne({ where: { username: user.username } });
            
            // Extract user_id using multiple methods (primary key is user_id, not id)
            const userId = dbUser ? (dbUser.user_id || dbUser.getDataValue?.('user_id') || dbUser.dataValues?.user_id || dbUser.id) : null;

            req.session.user = {
                id: userId,  // Store as 'id' for consistency
                user_id: userId,  // Also store as 'user_id' for compatibility
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
            
            // Mark session as modified and save
            req.session.touch();
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Session save failed' });
                }
                
                console.log('Session saved successfully, cookie will be set');
                // Set cookie explicitly to ensure it's sent with longer expiration
                res.cookie('connect.sid', req.sessionID, {
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                    httpOnly: true,
                    sameSite: 'lax',
                    path: '/',
                    domain: undefined
                });
                
                // Also set a non-httpOnly cookie for client-side detection
                res.cookie('sessionActive', 'true', {
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                    httpOnly: false, // Allow client-side access
                    sameSite: 'lax',
                    path: '/',
                    domain: undefined
                });
                
                // Store username in cookie for session restoration
                res.cookie('currentUsername', user.username, {
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                    httpOnly: false, // Allow client-side access if needed
                    sameSite: 'lax',
                    path: '/',
                    domain: undefined
                });
                
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

app.get('/api/auth/check', async (req, res) => {
    console.log('[Auth Check] ========== START ==========');
    console.log('[Auth Check] Request received');
    console.log('[Auth Check] Session ID:', req.sessionID);
    console.log('[Auth Check] Has session object:', !!req.session);
    console.log('[Auth Check] Session keys:', req.session ? Object.keys(req.session) : 'no session');
    console.log('[Auth Check] Has session.user:', !!req.session?.user);
    console.log('[Auth Check] Cookies header:', req.headers.cookie ? 'present' : 'missing');
    
    // Touch the session to keep it alive (reset expiration)
    if (req.session) {
    req.session.touch();
    }
    
    // Check for session user
    let sessionUser = req.session?.user;
    
    // If no session user but session exists, try to restore from database
    if (!sessionUser && req.session && req.sessionID) {
        console.log('[Auth Check] No session user, attempting to restore from database...');
        
        // Try to reload session first
        try {
            await new Promise((resolve, reject) => {
                req.session.reload((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            sessionUser = req.session?.user;
            if (sessionUser) {
                console.log('[Auth Check] Session reloaded, found user:', sessionUser.username);
            }
        } catch (reloadError) {
            console.log('[Auth Check] Session reload failed, will try database restore');
        }
        
        // If still no user, try to restore using restoreSessionUser with null username
        // This will try to find the user from the session store if possible
        if (!sessionUser) {
            try {
                const restoredUser = await restoreSessionUser(req, null);
                if (restoredUser) {
                    sessionUser = req.session?.user;
                    console.log('[Auth Check] Session restored from database:', sessionUser?.username);
                }
            } catch (restoreError) {
                console.log('[Auth Check] Session restore failed:', restoreError.message);
            }
        }
        
        // If still no user, return failure
        if (!sessionUser) {
            console.log('[Auth Check] Cannot restore session - no user found');
            console.log('[Auth Check] ========== END (NO USER) ==========');
            return res.json({
                success: false,
                user: null,
                error: 'No session user found'
            });
        }
    }
    
    // Ensure session is saved
    if (sessionUser) {
        // Extract username with fallbacks
        const username = sessionUser.username || 
                        sessionUser.getDataValue?.('username') || 
                        sessionUser.dataValues?.username;
        
        console.log('[Auth Check] Extracted username:', username);
        
        if (username) {
        // Save session to ensure it persists and extend expiration
        req.session.save((err) => {
            if (err) {
                console.error('[Auth Check] Session save error:', err);
            } else {
                console.log('[Auth Check] Session saved successfully');
            }
        });
        
        // Explicitly set cookie to refresh expiration
        res.cookie('connect.sid', req.sessionID, {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            httpOnly: true,
            sameSite: 'lax',
                path: '/',
                domain: undefined
            });
            
            res.cookie('sessionActive', 'true', {
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                httpOnly: false,
                sameSite: 'lax',
                path: '/',
                domain: undefined
            });
            
            console.log('[Auth Check] Returning success with user:', username);
            console.log('[Auth Check] ========== END (SUCCESS) ==========');
        res.json({
            success: true,
                user: sessionUser
        });
    } else {
            console.log('[Auth Check] Session user exists but no username found');
            console.log('[Auth Check] ========== END (NO USERNAME) ==========');
        res.json({
            success: false,
                user: null,
                error: 'Session user missing username'
            });
        }
    } else {
        console.log('[Auth Check] No session user found - returning failure');
        console.log('[Auth Check] ========== END (NO USER) ==========');
        res.json({
            success: false,
            user: null,
            error: 'No session user found'
        });
    }
});

app.post('/api/auth/refresh', async (req, res) => {
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
    }
    
    let sessionUser = req.session?.user;
    
    // If no session user but session exists, try to restore
    if (!sessionUser && req.session && req.sessionID) {
        console.log('[Auth Refresh] No session user, attempting to restore...');
        
        // Try to reload session
        try {
            await new Promise((resolve, reject) => {
                req.session.reload((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            sessionUser = req.session?.user;
        } catch (error) {
            console.error('[Auth Refresh] Session reload failed:', error);
        }
    }
    
    if (sessionUser) {
        // Save session to extend expiration
        req.session.save((err) => {
            if (err) {
                console.error('[Auth Refresh] Session save error:', err);
                return res.status(500).json({ success: false, error: 'Failed to refresh session' });
            }
            
            // Refresh cookie
            res.cookie('connect.sid', req.sessionID, {
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                domain: undefined
            });
            
            res.cookie('sessionActive', 'true', {
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                httpOnly: false,
                sameSite: 'lax',
                path: '/',
                domain: undefined
            });
            
            res.json({
                success: true,
                user: sessionUser
            });
        });
    } else {
        res.status(401).json({ success: false, error: 'No active session' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

app.get('/api/auth/steam', (req, res, next) => {
    console.log('[Steam Auth] Starting Steam OAuth flow...');
    console.log('[Steam Auth] Session ID:', req.sessionID);
    console.log('[Steam Auth] Session user:', req.session.user ? req.session.user.username : 'none');
    console.log('[Steam Auth] Return URL:', process.env.STEAM_RETURN_URL || 'http://localhost:3000/api/auth/steam/return');
    console.log('[Steam Auth] Realm:', process.env.STEAM_REALM || 'http://localhost:3000');
    
    // Ensure session is saved before redirecting to Steam
    req.session.save((err) => {
        if (err) {
            console.error('[Steam Auth] Error saving session before redirect:', err);
        } else {
            console.log('[Steam Auth] Session saved, redirecting to Steam...');
        }
        // Continue with Steam authentication
        passport.authenticate('steam', { failureRedirect: '/profile?error=steam_auth_failed' })(req, res, next);
    });
});

app.get('/api/auth/steam/return', (req, res, next) => {
    console.log('[Steam Return Handler] Steam OAuth callback received');
    console.log('[Steam Return Handler] Query params:', req.query);
    console.log('[Steam Return Handler] Session ID:', req.sessionID);
    console.log('[Steam Return Handler] Session exists:', !!req.session);
    
    // Authenticate with Steam
    passport.authenticate('steam', { failureRedirect: '/profile?error=steam_auth_failed&reason=oauth_failed' }, async (err, user, info) => {
        if (err) {
            console.error('[Steam Return Handler] Passport authentication error:', err);
            return res.redirect('/profile?error=steam_auth_failed&reason=oauth_error&details=' + encodeURIComponent(err.message));
        }
        
        if (!user) {
            console.error('[Steam Return Handler] Passport authentication failed - no user');
            return res.redirect('/profile?error=steam_auth_failed&reason=oauth_no_user');
        }
        
        console.log('[Steam Return Handler] Passport authentication successful, user:', user.steamId);
        
        // Set req.user for the rest of the handler
        req.user = user;
        
        // Continue to the async handler
        next();
    })(req, res, next);
}, async (req, res) => {
    try {
        console.log('[Steam Return] ==========================================');
        console.log('[Steam Return] Steam OAuth return - Processing Steam authentication...');
        console.log('[Steam Return] Session user at return:', req.session.user ? req.session.user.username : 'none');
        console.log('[Steam Return] Passport user:', req.user ? req.user.steamId : 'none');
        console.log('[Steam Return] Stored Steam link user info:', req.session.steamLinkUser || 'none');
        
        if (!req.user || !req.user.steamId) {
            console.error('[Steam Return] No Steam user data from OAuth');
            return res.redirect('/profile?error=steam_auth_failed&reason=no_user_data');
        }
        
        console.log('[Steam Return] Steam ID from OAuth:', req.user.steamId);
        
        // Steam user data is available, proceed with linking
        // Try to get full Steam profile with API key, but use basic info from OAuth if it fails
        let steamProfile = null;
        try {
            const steamProfileResult = await steamService.getUserProfile(req.user.steamId);
            if (steamProfileResult && steamProfileResult.success) {
                console.log('[Steam Return] Steam profile fetched successfully via API:', steamProfileResult.profile?.personaname || 'Unknown');
                steamProfile = steamProfileResult.profile;
            } else {
                console.log('[Steam Return] Steam API key not available or failed, using basic profile from OAuth:', steamProfileResult?.error || 'Unknown error');
                // Use basic profile info from passport strategy if API call fails
                const profileData = req.user.profile || {};
                steamProfile = {
                    steamid: req.user.steamId,
                    personaname: profileData.username || profileData.displayName || 'Steam User',
                    profileurl: profileData.profileUrl || `https://steamcommunity.com/profiles/${req.user.steamId}`,
                    avatar: profileData.photos?.[0]?.value || null,
                    avatarmedium: profileData.photos?.[1]?.value || null,
                    avatarfull: profileData.photos?.[2]?.value || null
                };
                console.log('[Steam Return] Using basic Steam profile from OAuth:', steamProfile.personaname);
            }
        } catch (profileError) {
            console.error('[Steam Return] Error fetching Steam profile, using minimal profile:', profileError.message);
            // Fallback to minimal profile if both API and OAuth profile fail
            steamProfile = {
                steamid: req.user.steamId,
                personaname: 'Steam User',
                profileurl: `https://steamcommunity.com/profiles/${req.user.steamId}`,
                avatar: null,
                avatarmedium: null,
                avatarfull: null
            };
        }
        
        if (!steamProfile || !steamProfile.steamid) {
            console.error('[Steam Return] Failed to create Steam profile object');
            return res.redirect('/profile?error=steam_auth_failed&reason=profile_creation_failed');
        }
                
                // Check if user is already logged in
                if (req.session.user && req.session.user.username) {
            console.log('[Steam Return] Linking Steam to existing user:', req.session.user.username);
                    
                    // Link Steam account to existing account
                    const user = await profileManager.getUserByUsername(req.session.user.username);
            if (!user) {
                console.error('[Steam Return] User not found:', req.session.user.username);
                return res.redirect('/profile?error=steam_auth_failed&reason=user_not_found');
            }
            
            // Extract values from Sequelize instance
            const userSteamId = user.steam_id || user.getDataValue?.('steam_id') || user.dataValues?.steam_id || null;
            
                        // Check if user already has Steam linked
            if (userSteamId) {
                console.log('[Steam Return] User already has Steam account linked:', userSteamId);
                            // Just reload the data
                            const updatedUser = await profileManager.getUserByUsername(req.session.user.username);
                if (!updatedUser) {
                    console.error('[Steam Return] Failed to reload user after Steam check');
                    return res.redirect('/profile?error=steam_auth_failed&reason=reload_failed');
                }
                
                // Extract values from Sequelize instance
                            req.session.user = {
                    username: updatedUser.username || updatedUser.getDataValue?.('username') || updatedUser.dataValues?.username,
                    email: updatedUser.email || updatedUser.getDataValue?.('email') || updatedUser.dataValues?.email,
                    joinDate: updatedUser.joinDate || updatedUser.getDataValue?.('join_date') || updatedUser.dataValues?.join_date,
                    bio: updatedUser.bio || updatedUser.getDataValue?.('bio') || updatedUser.dataValues?.bio,
                    gamingPreferences: updatedUser.gamingPreferences || updatedUser.getDataValue?.('gaming_preferences') || updatedUser.dataValues?.gaming_preferences,
                    statistics: updatedUser.statistics || updatedUser.getDataValue?.('statistics') || updatedUser.dataValues?.statistics,
                    achievements: updatedUser.achievements || updatedUser.getDataValue?.('achievements') || updatedUser.dataValues?.achievements,
                    steam_id: updatedUser.steam_id || updatedUser.getDataValue?.('steam_id') || updatedUser.dataValues?.steam_id,
                    steam_profile: updatedUser.steam_profile || updatedUser.getDataValue?.('steam_profile') || updatedUser.dataValues?.steam_profile,
                    steam_games: updatedUser.steam_games || updatedUser.getDataValue?.('steam_games') || updatedUser.dataValues?.steam_games,
                    steam_last_sync: updatedUser.steam_last_sync || updatedUser.getDataValue?.('steam_last_sync') || updatedUser.dataValues?.steam_last_sync
                            };
                        } else {
                            // Link Steam account and auto-import games
                console.log('[Steam Return] Linking Steam account to user:', req.session.user.username);
                let dbUser;
                try {
                    dbUser = await User.findOne({ where: { username: req.session.user.username } });
                } catch (dbError) {
                    console.error('[Steam Return] Error finding user in database:', dbError.message);
                    return res.redirect('/profile?error=steam_auth_failed&reason=database_error&details=' + encodeURIComponent(dbError.message));
                }
                
                if (!dbUser) {
                    console.error('[Steam Return] Database user not found:', req.session.user.username);
                    return res.redirect('/profile?error=steam_auth_failed&reason=db_user_not_found');
                }
                
                let linkResult;
                try {
                    console.log('[Steam Return] Calling linkSteamAccount with:', {
                        steamId: req.user.steamId,
                        username: dbUser.username,
                        hasSteamProfile: !!steamProfile
                    });
                    linkResult = await steamService.linkSteamAccount(dbUser, req.user.steamId, steamProfile);
                    console.log('[Steam Return] Link result:', {
                        success: linkResult.success,
                        gamesSynced: linkResult.gamesSynced,
                        syncSuccess: linkResult.syncResult?.success,
                        syncError: linkResult.syncResult?.error,
                        gamesCount: linkResult.syncResult?.gamesCount
                    });
                } catch (linkError) {
                    console.error('[Steam Return] Exception linking Steam account:', linkError.message, linkError.stack);
                    return res.redirect('/profile?error=steam_auth_failed&reason=link_exception&details=' + encodeURIComponent(linkError.message));
                }
                
                console.log('[Steam Return] Steam account linked:', linkResult.success ? 'success' : 'failed');
                
                if (!linkResult.success) {
                    console.error('[Steam Return] Failed to link Steam account:', linkResult.error);
                    return res.redirect(`/profile?error=steam_auth_failed&reason=link_failed&details=${encodeURIComponent(linkResult.error || 'Unknown error')}`);
                }
                
                // Log sync result for debugging
                if (linkResult.syncResult) {
                    if (linkResult.syncResult.success) {
                        console.log('[Steam Return] Games sync successful:', {
                            gamesCount: linkResult.syncResult.gamesCount,
                            totalPlaytime: linkResult.syncResult.totalPlaytime,
                            totalAchievements: linkResult.syncResult.totalAchievements
                        });
                    } else {
                        console.error('[Steam Return] Games sync failed:', linkResult.syncResult.error);
                        // Don't fail the whole linking if sync fails - account is still linked
                    }
                }
                
                // Wait longer to ensure database commit and sync completes
                // Give more time for game sync to complete (it can take a while with delays)
                console.log('[Steam Return] Waiting for sync to complete...');
                await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3 seconds
                
                // Reload user data from database using profileManager
                let updatedUser;
                try {
                    updatedUser = await profileManager.getUserByUsername(req.session.user.username);
                } catch (reloadError) {
                    console.error('[Steam Return] Error reloading user:', reloadError.message);
                    // Even if reload fails, we can still update session with what we know
                    req.session.user.steam_id = req.user.steamId;
                    req.session.user.steam_profile = steamProfile;
                    req.session.save();
                    return res.redirect('/profile?steam_auth=success&warning=reload_failed');
                }
                
                if (!updatedUser) {
                    console.error('[Steam Return] Failed to reload user after Steam linking');
                    // Still update session with Steam ID even if reload fails
                    req.session.user.steam_id = req.user.steamId;
                    req.session.user.steam_profile = steamProfile;
                    req.session.save();
                    return res.redirect('/profile?steam_auth=success&warning=reload_failed');
                }
                
                // Also reload from database directly to ensure we have the latest games
                console.log('[Steam Return] Reloading user from database directly to get synced games...');
                const dbUserReload = await User.findOne({ 
                    where: { username: req.session.user.username },
                    attributes: ['username', 'steam_id', 'steam_profile', 'steam_games', 'steam_last_sync', 'statistics']
                });
                if (dbUserReload) {
                    const reloadedGames = dbUserReload.steam_games || dbUserReload.getDataValue?.('steam_games') || dbUserReload.dataValues?.steam_games;
                    console.log('[Steam Return] Direct reload - games count:', reloadedGames ? (Array.isArray(reloadedGames) ? reloadedGames.length : 'not array') : 0);
                    console.log('[Steam Return] Direct reload - statistics:', dbUserReload.statistics || dbUserReload.getDataValue?.('statistics') || dbUserReload.dataValues?.statistics || 'none');
                }
                
                // Extract values from Sequelize instance - try multiple methods
                let steamId = null;
                if (updatedUser.steam_id) {
                    steamId = updatedUser.steam_id;
                } else if (updatedUser.getDataValue && updatedUser.getDataValue('steam_id')) {
                    steamId = updatedUser.getDataValue('steam_id');
                } else if (updatedUser.dataValues && updatedUser.dataValues.steam_id) {
                    steamId = updatedUser.dataValues.steam_id;
                } else if (updatedUser.toJSON && updatedUser.toJSON().steam_id) {
                    steamId = updatedUser.toJSON().steam_id;
                } else {
                    steamId = req.user.steamId; // Fallback to OAuth steam ID
                }
                
                console.log('[Steam Return] Reloaded user from database - Steam ID extraction:', {
                    direct: updatedUser.steam_id,
                    getDataValue: updatedUser.getDataValue ? updatedUser.getDataValue('steam_id') : 'N/A',
                    dataValues: updatedUser.dataValues ? updatedUser.dataValues.steam_id : 'N/A',
                    oauth: req.user.steamId,
                    final: steamId
                });
                
                // If Steam ID is still missing, verify with direct database query
                if (!steamId || steamId === null) {
                    console.warn('[Steam Return] Steam ID not found in user object, querying database directly...');
                    const verifyUser = await User.findOne({ 
                        where: { username: req.session.user.username },
                        attributes: ['username', 'steam_id']
                    });
                    if (verifyUser) {
                        steamId = verifyUser.steam_id || verifyUser.getDataValue?.('steam_id') || verifyUser.dataValues?.steam_id;
                        console.log('[Steam Return] Direct database query - Steam ID:', steamId || 'still missing');
                    }
                }
                
                console.log('[Steam Return] Final Steam ID:', steamId || 'MISSING - LINKING FAILED!');
                console.log('[Steam Return] Reloaded user - Steam profile:', (updatedUser.steam_profile || updatedUser.getDataValue?.('steam_profile') || updatedUser.dataValues?.steam_profile) ? 'present' : 'missing');
                
                // Update session with complete user data including Steam games and statistics
                try {
                    // Prefer direct database reload for games (more reliable)
                    let steamGames = null;
                    let userStatistics = {};
                    
                    if (dbUserReload) {
                        steamGames = dbUserReload.steam_games || dbUserReload.getDataValue?.('steam_games') || dbUserReload.dataValues?.steam_games || null;
                        userStatistics = dbUserReload.statistics || dbUserReload.getDataValue?.('statistics') || dbUserReload.dataValues?.statistics || {};
                        console.log('[Steam Return] Using direct database reload for games and statistics');
                    } else {
                        // Fallback to updatedUser
                        steamGames = updatedUser.steam_games || updatedUser.getDataValue?.('steam_games') || updatedUser.dataValues?.steam_games || null;
                        userStatistics = updatedUser.statistics || updatedUser.getDataValue?.('statistics') || updatedUser.dataValues?.statistics || req.session.user.statistics || {};
                        console.log('[Steam Return] Using updatedUser for games and statistics (fallback)');
                    }
                    
                    const steamProfileData = updatedUser.steam_profile || updatedUser.getDataValue?.('steam_profile') || updatedUser.dataValues?.steam_profile || steamProfile;
                    
                    console.log('[Steam Return] Loading Steam data into session:', {
                        steamId: steamId,
                        hasSteamGames: !!steamGames,
                        gamesCount: steamGames ? (Array.isArray(steamGames) ? steamGames.length : 'not array') : 0,
                        hasSteamProfile: !!steamProfileData,
                        statistics: userStatistics,
                        totalGamesPlayed: userStatistics.totalGamesPlayed || 0
                    });
                    
                                req.session.user = {
                        username: updatedUser.username || updatedUser.getDataValue?.('username') || updatedUser.dataValues?.username || req.session.user.username,
                        email: updatedUser.email || updatedUser.getDataValue?.('email') || updatedUser.dataValues?.email || req.session.user.email,
                        joinDate: updatedUser.joinDate || updatedUser.getDataValue?.('join_date') || updatedUser.dataValues?.join_date || req.session.user.joinDate,
                        bio: updatedUser.bio || updatedUser.getDataValue?.('bio') || updatedUser.dataValues?.bio || req.session.user.bio,
                        gamingPreferences: updatedUser.gamingPreferences || updatedUser.getDataValue?.('gaming_preferences') || updatedUser.dataValues?.gaming_preferences || req.session.user.gamingPreferences,
                        statistics: userStatistics,
                        achievements: updatedUser.achievements || updatedUser.getDataValue?.('achievements') || updatedUser.dataValues?.achievements || req.session.user.achievements,
                        steam_id: steamId,
                        steam_profile: steamProfileData,
                        steam_games: steamGames,
                        steam_last_sync: updatedUser.steam_last_sync || updatedUser.getDataValue?.('steam_last_sync') || updatedUser.dataValues?.steam_last_sync || req.session.user.steam_last_sync
                    };
                    
                    console.log('[Steam Return] Session updated with Steam data:', {
                        steam_id: req.session.user.steam_id,
                        has_steam_profile: !!req.session.user.steam_profile,
                        has_steam_games: !!req.session.user.steam_games,
                        games_count: req.session.user.steam_games ? (Array.isArray(req.session.user.steam_games) ? req.session.user.steam_games.length : 'not array') : 0,
                        statistics: req.session.user.statistics
                    });
                } catch (sessionError) {
                    console.error('[Steam Return] Error updating session:', sessionError.message);
                    // At minimum, update Steam ID
                    req.session.user.steam_id = req.user.steamId;
                    req.session.user.steam_profile = steamProfile;
                }
            }
            
            console.log('[Steam Return] Session updated with complete user data including Steam info');
            
            // Force session save before redirect
            req.session.save((err) => {
                if (err) {
                    console.error('[Steam Return] Error saving session:', err);
                            } else {
                    console.log('[Steam Return] Session saved successfully');
                }
            });
        } else if (req.session.steamLinkUser && req.session.steamLinkUser.username) {
            // Session user was lost, but we have the Steam link user info
            console.log('[Steam Return] Session user lost, using stored Steam link user:', req.session.steamLinkUser.username);
                        
                        const user = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                        if (user) {
                                // Link Steam account and auto-import games
                const dbUser = await User.findOne({ where: { username: req.session.steamLinkUser.username } });
                if (dbUser) {
                    const linkResult = await steamService.linkSteamAccount(dbUser, req.user.steamId, steamProfile);
                    console.log('[Steam Return] Steam account linked to stored user:', linkResult.success ? 'success' : 'failed');
                                
                                // Reload user data from database to get all fields including Steam data
                                const updatedUser = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                                
                    if (!updatedUser) {
                        console.error('[Steam Return] Failed to reload user after linking');
                        return res.redirect('/profile?error=steam_auth_failed&reason=reload_failed');
                    }
                    
                    // Extract values from Sequelize instance
                                req.session.user = {
                        username: updatedUser.username || updatedUser.getDataValue?.('username') || updatedUser.dataValues?.username,
                        email: updatedUser.email || updatedUser.getDataValue?.('email') || updatedUser.dataValues?.email,
                        joinDate: updatedUser.joinDate || updatedUser.getDataValue?.('join_date') || updatedUser.dataValues?.join_date,
                        bio: updatedUser.bio || updatedUser.getDataValue?.('bio') || updatedUser.dataValues?.bio,
                        gamingPreferences: updatedUser.gamingPreferences || updatedUser.getDataValue?.('gaming_preferences') || updatedUser.dataValues?.gaming_preferences,
                        statistics: updatedUser.statistics || updatedUser.getDataValue?.('statistics') || updatedUser.dataValues?.statistics,
                        achievements: updatedUser.achievements || updatedUser.getDataValue?.('achievements') || updatedUser.dataValues?.achievements,
                        steam_id: updatedUser.steam_id || updatedUser.getDataValue?.('steam_id') || updatedUser.dataValues?.steam_id,
                        steam_profile: updatedUser.steam_profile || updatedUser.getDataValue?.('steam_profile') || updatedUser.dataValues?.steam_profile,
                        steam_games: updatedUser.steam_games || updatedUser.getDataValue?.('steam_games') || updatedUser.dataValues?.steam_games,
                        steam_last_sync: updatedUser.steam_last_sync || updatedUser.getDataValue?.('steam_last_sync') || updatedUser.dataValues?.steam_last_sync
                    };
                            
                            // Clear the stored Steam link user info
                            delete req.session.steamLinkUser;
                            
                    console.log('[Steam Return] Session restored with complete user data including Steam info');
                } else {
                    console.error('[Steam Return] Database user not found for Steam link user:', req.session.steamLinkUser.username);
                    return res.redirect('/profile?error=steam_auth_failed&reason=db_user_not_found');
                        }
                    } else {
                console.error('[Steam Return] User not found for Steam link user:', req.session.steamLinkUser.username);
                return res.redirect('/profile?error=steam_auth_failed&reason=user_not_found');
            }
        } else {
            // No session user and no steamLinkUser - try to match or create
            console.log('[Steam Return] No session user, checking if this is a sign-in or link...');
            
            const isSteamSignIn = req.session.steamSignIn === true;
            console.log('[Steam Return] Is Steam sign-in:', isSteamSignIn);
            
            // First, check if Steam ID is already linked to an account
                            const existingUser = await profileManager.getUserBySteamId(req.user.steamId);
                            if (existingUser) {
                console.log('[Steam Return] Found existing user with Steam ID:', existingUser.username);
                                const userData = await profileManager.getUserByUsername(existingUser.username);
                if (userData) {
                                req.session.user = {
                        username: userData.username || userData.getDataValue?.('username') || userData.dataValues?.username,
                        email: userData.email || userData.getDataValue?.('email') || userData.dataValues?.email,
                        joinDate: userData.joinDate || userData.getDataValue?.('join_date') || userData.dataValues?.join_date,
                        bio: userData.bio || userData.getDataValue?.('bio') || userData.dataValues?.bio,
                        gamingPreferences: userData.gamingPreferences || userData.getDataValue?.('gaming_preferences') || userData.dataValues?.gaming_preferences,
                        statistics: userData.statistics || userData.getDataValue?.('statistics') || userData.dataValues?.statistics,
                        achievements: userData.achievements || userData.getDataValue?.('achievements') || userData.dataValues?.achievements,
                        steam_id: userData.steam_id || userData.getDataValue?.('steam_id') || userData.dataValues?.steam_id,
                        steam_profile: userData.steam_profile || userData.getDataValue?.('steam_profile') || userData.dataValues?.steam_profile,
                        steam_games: userData.steam_games || userData.getDataValue?.('steam_games') || userData.dataValues?.steam_games,
                        steam_last_sync: userData.steam_last_sync || userData.getDataValue?.('steam_last_sync') || userData.dataValues?.steam_last_sync
                    };
                    
                    // Auto-sync games if this is a sign-in and games haven't been synced recently
                    if (isSteamSignIn && (!userData.steam_last_sync || (new Date() - new Date(userData.steam_last_sync)) > 24 * 60 * 60 * 1000)) {
                        console.log('[Steam Return] Auto-syncing games for signed-in user...');
                        const dbUser = await User.findOne({ where: { username: existingUser.username } });
                        if (dbUser) {
                            try {
                                await steamService.syncUserGames(dbUser);
                                console.log('[Steam Return] Games auto-synced successfully');
                            } catch (syncError) {
                                console.error('[Steam Return] Error auto-syncing games:', syncError);
                                // Don't fail sign-in if sync fails
                            }
                        }
                    }
                    
                    delete req.session.steamSignIn;
                }
            } else if (isSteamSignIn) {
                // This is a sign-in and no account exists - create new account
                console.log('[Steam Return] Creating new account from Steam sign-in...');
                
                // Generate username from Steam persona name (sanitize and ensure uniqueness)
                let baseUsername = steamProfile.personaname || `steam_${req.user.steamId}`;
                baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 20);
                
                // Ensure username is unique
                let username = baseUsername;
                let counter = 1;
                while (await profileManager.getUserByUsername(username)) {
                    username = `${baseUsername}${counter}`;
                    counter++;
                }
                
                // Create new user account
                const bcrypt = require('bcrypt');
                const randomPassword = require('crypto').randomBytes(16).toString('hex');
                const passwordHash = await bcrypt.hash(randomPassword, 10);
                
                const newUserData = {
                    username: username,
                    email: `${username}@steam.local`, // Placeholder email
                    password_hash: passwordHash,
                    steam_id: req.user.steamId,
                    steam_profile: steamProfile,
                    steam_linked_at: new Date(),
                    join_date: new Date(),
                    is_active: true,
                    is_admin: false,
                    gaming_preferences: {
                                    playStyle: 'casual',
                                    favoriteGenres: [],
                                    preferredPlatforms: ['PC']
                    },
                    statistics: {},
                    bio: ''
                };
                
                const newUser = await databaseManager.saveUser(newUserData);
                console.log('[Steam Return] New user created:', username);
                
                // Link Steam account and auto-sync games
                const dbUser = await User.findOne({ where: { username } });
                if (dbUser) {
                    try {
                        const linkResult = await steamService.linkSteamAccount(dbUser, req.user.steamId, steamProfile);
                        console.log('[Steam Return] Steam account linked and games synced:', linkResult.success);
                        
                        // Reload user to get synced data
                        const updatedUser = await profileManager.getUserByUsername(username);
                        if (updatedUser) {
                                    req.session.user = {
                                username: updatedUser.username || updatedUser.getDataValue?.('username') || updatedUser.dataValues?.username,
                                email: updatedUser.email || updatedUser.getDataValue?.('email') || updatedUser.dataValues?.email,
                                joinDate: updatedUser.joinDate || updatedUser.getDataValue?.('join_date') || updatedUser.dataValues?.join_date,
                                bio: updatedUser.bio || updatedUser.getDataValue?.('bio') || updatedUser.dataValues?.bio,
                                gamingPreferences: updatedUser.gamingPreferences || updatedUser.getDataValue?.('gaming_preferences') || updatedUser.dataValues?.gaming_preferences,
                                statistics: updatedUser.statistics || updatedUser.getDataValue?.('statistics') || updatedUser.dataValues?.statistics,
                                achievements: updatedUser.achievements || updatedUser.getDataValue?.('achievements') || updatedUser.dataValues?.achievements,
                                steam_id: updatedUser.steam_id || updatedUser.getDataValue?.('steam_id') || updatedUser.dataValues?.steam_id,
                                steam_profile: updatedUser.steam_profile || updatedUser.getDataValue?.('steam_profile') || updatedUser.dataValues?.steam_profile,
                                steam_games: updatedUser.steam_games || updatedUser.getDataValue?.('steam_games') || updatedUser.dataValues?.steam_games,
                                steam_last_sync: updatedUser.steam_last_sync || updatedUser.getDataValue?.('steam_last_sync') || updatedUser.dataValues?.steam_last_sync
                            };
                            console.log('[Steam Return] New user session created with Steam data');
                        }
                    } catch (linkError) {
                        console.error('[Steam Return] Error linking Steam to new account:', linkError);
                        // Still create session even if sync fails
                                    req.session.user = {
                            username: newUser.username || newUser.getDataValue?.('username') || newUser.dataValues?.username,
                            email: newUser.email || newUser.getDataValue?.('email') || newUser.dataValues?.email,
                                        steam_id: req.user.steamId,
                            steam_profile: steamProfile
                        };
                    }
                }
                
                delete req.session.steamSignIn;
            } else {
                // Try to match Steam username with existing user (original fallback logic)
                console.log('[Steam Return] Trying to match Steam username with existing user...');
                const steamUsername = steamProfile.personaname;
                console.log('[Steam Return] Steam username:', steamUsername);
                        
                // Try to find user by username that matches Steam username
                const matchingUser = await profileManager.getUserByUsername(steamUsername);
                if (matchingUser) {
                    const matchingSteamId = matchingUser.steam_id || matchingUser.getDataValue?.('steam_id') || matchingUser.dataValues?.steam_id || null;
                    if (!matchingSteamId) {
                        console.log('[Steam Return] Found matching user without Steam linked:', matchingUser.username);
                            
                            // Link Steam account to the matching user
                        const dbUser = await User.findOne({ where: { username: matchingUser.username } });
                        if (dbUser) {
                            const linkResult = await steamService.linkSteamAccount(dbUser, req.user.steamId, steamProfile);
                            console.log('[Steam Return] Steam account linked to matching user:', linkResult.success ? 'success' : 'failed');
                            
                            // Reload user data from database to get all fields including Steam data
                            const updatedUser = await profileManager.getUserByUsername(matchingUser.username);
                            if (updatedUser) {
                                // Extract values from Sequelize instance
                            req.session.user = {
                                    username: updatedUser.username || updatedUser.getDataValue?.('username') || updatedUser.dataValues?.username,
                                    email: updatedUser.email || updatedUser.getDataValue?.('email') || updatedUser.dataValues?.email,
                                    joinDate: updatedUser.joinDate || updatedUser.getDataValue?.('join_date') || updatedUser.dataValues?.join_date,
                                    bio: updatedUser.bio || updatedUser.getDataValue?.('bio') || updatedUser.dataValues?.bio,
                                    gamingPreferences: updatedUser.gamingPreferences || updatedUser.getDataValue?.('gaming_preferences') || updatedUser.dataValues?.gaming_preferences,
                                    statistics: updatedUser.statistics || updatedUser.getDataValue?.('statistics') || updatedUser.dataValues?.statistics,
                                    achievements: updatedUser.achievements || updatedUser.getDataValue?.('achievements') || updatedUser.dataValues?.achievements,
                                    steam_id: updatedUser.steam_id || updatedUser.getDataValue?.('steam_id') || updatedUser.dataValues?.steam_id,
                                    steam_profile: updatedUser.steam_profile || updatedUser.getDataValue?.('steam_profile') || updatedUser.dataValues?.steam_profile,
                                    steam_games: updatedUser.steam_games || updatedUser.getDataValue?.('steam_games') || updatedUser.dataValues?.steam_games,
                                    steam_last_sync: updatedUser.steam_last_sync || updatedUser.getDataValue?.('steam_last_sync') || updatedUser.dataValues?.steam_last_sync
                                };
                                
                                console.log('[Steam Return] Session created with complete user data including Steam info');
                            }
                        }
                        } else {
                        // User already has Steam linked - just log them in
                        console.log('[Steam Return] Matching user already has Steam linked');
                        const updatedUser = await profileManager.getUserByUsername(matchingUser.username);
                        if (updatedUser) {
                            req.session.user = {
                                username: updatedUser.username || updatedUser.getDataValue?.('username') || updatedUser.dataValues?.username,
                                email: updatedUser.email || updatedUser.getDataValue?.('email') || updatedUser.dataValues?.email,
                                joinDate: updatedUser.joinDate || updatedUser.getDataValue?.('join_date') || updatedUser.dataValues?.join_date,
                                bio: updatedUser.bio || updatedUser.getDataValue?.('bio') || updatedUser.dataValues?.bio,
                                gamingPreferences: updatedUser.gamingPreferences || updatedUser.getDataValue?.('gaming_preferences') || updatedUser.dataValues?.gaming_preferences,
                                statistics: updatedUser.statistics || updatedUser.getDataValue?.('statistics') || updatedUser.dataValues?.statistics,
                                achievements: updatedUser.achievements || updatedUser.getDataValue?.('achievements') || updatedUser.dataValues?.achievements,
                                steam_id: updatedUser.steam_id || updatedUser.getDataValue?.('steam_id') || updatedUser.dataValues?.steam_id,
                                steam_profile: updatedUser.steam_profile || updatedUser.getDataValue?.('steam_profile') || updatedUser.dataValues?.steam_profile,
                                steam_games: updatedUser.steam_games || updatedUser.getDataValue?.('steam_games') || updatedUser.dataValues?.steam_games,
                                steam_last_sync: updatedUser.steam_last_sync || updatedUser.getDataValue?.('steam_last_sync') || updatedUser.dataValues?.steam_last_sync
                            };
                        }
                }
            } else {
                    // No matching user found and not a sign-in - redirect to profile
                    console.log('[Steam Return] No matching user found - redirecting to profile');
                    delete req.session.steamSignIn;
                    return res.redirect('/profile?error=steam_auth_no_account&message=Please log in first, then connect your Steam account');
                }
            }
        }
        
        // Clear steamSignIn flag if it was set
        delete req.session.steamSignIn;
        
        // Check if there's a return URL in the session or redirect to user's profile
        let returnUrl = req.session.returnUrl;
        delete req.session.returnUrl;
        
        if (!returnUrl && req.session.user && req.session.user.username) {
            returnUrl = `/profile/${req.session.user.username}`;
        } else if (!returnUrl) {
            returnUrl = '/profile';
        }
        
        // Determine separator for return URL
        const separator = returnUrl.includes('?') ? '&' : '?';
        res.redirect(`${returnUrl}${separator}steam_auth=success`);
    } catch (error) {
        console.error('[Steam Return] ==========================================');
        console.error('[Steam Return] ERROR processing Steam return:', error);
        console.error('[Steam Return] Error message:', error.message);
        console.error('[Steam Return] Error stack:', error.stack);
        console.error('[Steam Return] ==========================================');
        res.redirect(`/profile?error=steam_auth_failed&reason=exception&message=${encodeURIComponent(error.message)}`);
    }
});

app.post('/api/auth/steam/signin', async (req, res) => {
    try {
        console.log('[Steam Sign-In] Request received');
        
        // Store in session that this is a sign-in (not linking)
        req.session.steamSignIn = true;
        delete req.session.steamLinkUser; // Clear any link user info
        
        // Store return URL if provided
        if (req.body.returnUrl) {
            req.session.returnUrl = req.body.returnUrl;
        } else {
            req.session.returnUrl = '/';
        }
        
        // Save session before redirect
        req.session.save((err) => {
            if (err) {
                console.error('[Steam Sign-In] Error saving session:', err);
                return res.status(500).json({ error: 'Failed to save session. Please try again.' });
            }
            
            console.log('[Steam Sign-In] Session saved, returning redirect URL');
            res.json({ 
                success: true, 
                message: 'Redirecting to Steam authentication',
                redirectUrl: '/api/auth/steam'
            });
        });
    } catch (error) {
        console.error('[Steam Sign-In] Error:', error);
        res.status(500).json({ 
            error: `Failed to initiate Steam sign-in: ${error.message || 'Unknown error'}` 
        });
    }
});

app.post('/api/auth/steam/link/:username?', async (req, res) => {
    try {
        console.log('[Steam Link] Request received:', {
            params: req.params,
            body: req.body,
            sessionUser: req.session.user ? req.session.user.username : 'none'
        });

        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            console.error('[Steam Link] No username provided');
            return res.status(401).json({ error: 'Username required. Please log in first.' });
        }

        console.log('[Steam Link] Looking up user:', username);

        // Use profileManager to get user (handles user_id extraction correctly)
        let user = await profileManager.getUserByUsername(username);
        
        if (!user) {
            console.error('[Steam Link] User not found:', username);
            return res.status(404).json({ error: 'User not found' });
        }

        // Handle Sequelize instance - get plain values
        const usernameValue = user.username || user.getDataValue?.('username') || user.dataValues?.username;
        const steamIdValue = user.steam_id || user.getDataValue?.('steam_id') || user.dataValues?.steam_id || null;
        const emailValue = user.email || user.getDataValue?.('email') || user.dataValues?.email || null;

        console.log('[Steam Link] User found:', usernameValue, 'Steam ID:', steamIdValue || 'none');

        // Check if Steam is already linked
        if (steamIdValue) {
            console.log('[Steam Link] User already has Steam linked:', steamIdValue);
            return res.status(400).json({ error: 'Steam account already linked to this profile' });
        }

        // Store return URL and user info for after OAuth redirect
        if (req.body.returnUrl) {
            req.session.returnUrl = req.body.returnUrl;
            console.log('[Steam Link] Stored return URL:', req.body.returnUrl);
        } else {
            req.session.returnUrl = `/profile/${username}`;
            console.log('[Steam Link] Using default return URL:', req.session.returnUrl);
        }
        
        req.session.steamLinkUser = {
            username: usernameValue,
            email: emailValue
        };
        console.log('[Steam Link] Stored Steam link user info:', req.session.steamLinkUser);
        console.log('[Steam Link] Session ID:', req.sessionID);
        console.log('[Steam Link] Session cookie will be sent:', !!req.session);

        // Save session before redirect - CRITICAL for OAuth flow
        req.session.save((err) => {
            if (err) {
                console.error('[Steam Link] Error saving session:', err);
                return res.status(500).json({ error: 'Failed to save session. Please try again.' });
            }
            
            console.log('[Steam Link] Session saved successfully');
            console.log('[Steam Link] Session ID after save:', req.sessionID);
            console.log('[Steam Link] Returning redirect URL: /api/auth/steam');
            
            // Return the redirect URL - client will navigate to it
        res.json({ 
            success: true, 
            message: 'Redirecting to Steam authentication',
            redirectUrl: '/api/auth/steam'
            });
        });
    } catch (error) {
        console.error('[Steam Link] Error linking Steam account:', error);
        console.error('[Steam Link] Error stack:', error.stack);
        res.status(500).json({ 
            error: `Failed to link Steam account: ${error.message || 'Unknown error'}. Please check server logs.` 
        });
    }
});

app.post('/api/auth/steam/unlink', async (req, res) => {
    try {
        console.log('[Steam Unlink] Request received');
        console.log('[Steam Unlink] Session user:', req.session.user ? req.session.user.username : 'none');
        
        if (!req.session.user) {
            console.error('[Steam Unlink] No session user');
            return res.status(401).json({ success: false, error: 'User not logged in' });
        }

        const username = req.session.user.username;
        console.log('[Steam Unlink] Unlinking Steam for user:', username);

        // Get Sequelize User model instance directly from database
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            console.error('[Steam Unlink] User not found:', username);
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Extract steam_id to check if it's linked
        const steamId = user.steam_id || user.getDataValue?.('steam_id') || user.dataValues?.steam_id || null;
        
        if (!steamId) {
            console.log('[Steam Unlink] No Steam account linked for user:', username);
            return res.status(400).json({ success: false, error: 'No Steam account linked' });
        }

        console.log('[Steam Unlink] Steam ID found:', steamId, 'Unlinking...');

        // Unlink Steam account - use setDataValue for Sequelize instances
        if (user.setDataValue) {
            user.setDataValue('steam_id', null);
            user.setDataValue('steam_profile', null);
            user.setDataValue('steam_linked_at', null);
            user.setDataValue('steam_games', null);
            user.setDataValue('steam_last_sync', null);
        } else {
            user.steam_id = null;
            user.steam_profile = null;
            user.steam_linked_at = null;
            user.steam_games = null;
            user.steam_last_sync = null;
        }
        
        // Also set directly for compatibility
        user.steam_id = null;
        user.steam_profile = null;
        user.steam_linked_at = null;
        user.steam_games = null;
        user.steam_last_sync = null;
        
        await user.save();
        console.log('[Steam Unlink] User saved successfully');

        // Update session
            req.session.user.steam_id = null;
            req.session.user.steam_profile = null;
        req.session.user.steam_games = null;
        req.session.user.steam_last_sync = null;
        await req.session.save();
        console.log('[Steam Unlink] Session updated');

            res.json({ success: true, message: 'Steam account unlinked successfully' });
    } catch (error) {
        console.error('[Steam Unlink] Error unlinking Steam account:', error);
        console.error('[Steam Unlink] Error stack:', error.stack);
        res.status(500).json({ success: false, error: 'Failed to unlink Steam account: ' + error.message });
    }
});

app.get('/api/auth/steam/status/:username?', async (req, res) => {
    try {

        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.json({ linked: false });
        }

        const user = await profileManager.getUserByUsername(username);
        if (user && user.steam_id) {
            res.json({
                linked: true,
                steam_id: user.steam_id,
                steam_profile: user.steam_profile,
                steam_games: user.steam_games,
                steam_last_sync: user.steam_last_sync
            });
        } else {

            if (req.session.user && req.session.user.username === username && req.session.user.steam_id) {
                res.json({
                    linked: true,
                    steam_id: req.session.user.steam_id,
                    steam_profile: req.session.user.steam_profile
                });
            } else {
                res.json({ linked: false });
            }
        }
    } catch (error) {
        console.error('Error checking Steam status:', error);
        res.json({ linked: false });
    }
});

app.post('/api/auth/steam/unlink/:username?', async (req, res) => {
    try {
        console.log('[Steam Unlink] Request received with username param');
        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        console.log('[Steam Unlink] Username:', username);
        
        if (!username) {
            return res.status(401).json({ success: false, error: 'Username required' });
        }

        // Get Sequelize User model instance directly from database
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            console.error('[Steam Unlink] User not found:', username);
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Extract steam_id to check if it's linked
        const steamId = user.steam_id || user.getDataValue?.('steam_id') || user.dataValues?.steam_id || null;
        
        if (!steamId) {
            console.log('[Steam Unlink] No Steam account linked for user:', username);
            return res.status(400).json({ success: false, error: 'No Steam account linked' });
        }

        console.log('[Steam Unlink] Steam ID found:', steamId, 'Unlinking...');

        // Unlink Steam account - use setDataValue for Sequelize instances
        if (user.setDataValue) {
            user.setDataValue('steam_id', null);
            user.setDataValue('steam_profile', null);
            user.setDataValue('steam_linked_at', null);
            user.setDataValue('steam_games', null);
            user.setDataValue('steam_last_sync', null);
        } else {
            user.steam_id = null;
            user.steam_profile = null;
            user.steam_linked_at = null;
            user.steam_games = null;
            user.steam_last_sync = null;
        }
        
        // Also set directly for compatibility
        user.steam_id = null;
        user.steam_profile = null;
        user.steam_linked_at = null;
        user.steam_games = null;
        user.steam_last_sync = null;
        
        await user.save();
        console.log('[Steam Unlink] User saved successfully');

        // Update session if this is the current user
        if (req.session.user && req.session.user.username === username) {
            req.session.user.steam_id = null;
            req.session.user.steam_profile = null;
            req.session.user.steam_games = null;
            req.session.user.steam_last_sync = null;
            await req.session.save();
            console.log('[Steam Unlink] Session updated');
        }

        res.json({ success: true, message: 'Steam account unlinked successfully' });
    } catch (error) {
        console.error('[Steam Unlink] Error unlinking Steam account:', error);
        console.error('[Steam Unlink] Error stack:', error.stack);
        res.status(500).json({ success: false, error: 'Failed to unlink Steam account: ' + error.message });
    }
});

app.get('/api/steam/profile', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user.steam_id) {
            return res.status(401).json({ error: 'Steam account not linked' });
        }

        const steamProfileResult = await steamService.getUserProfile(req.session.user.steam_id);
        if (steamProfileResult.success) {
            res.json({ success: true, profile: steamProfileResult.profile });
        } else {
            res.status(400).json({ error: steamProfileResult.error });
        }
    } catch (error) {
        console.error('Error fetching Steam profile:', error);
        res.status(500).json({ error: 'Failed to fetch Steam profile' });
    }
});

app.get('/api/steam/games/:username?', async (req, res) => {
    try {
        console.log('[Steam Games API] Request received');
        console.log('[Steam Games API] Params:', req.params);
        console.log('[Steam Games API] Session user:', req.session.user ? req.session.user.username : 'none');
        
        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            console.error('[Steam Games API] No username provided');
            return res.status(400).json({ 
                success: false,
                error: 'Username required',
                message: 'Username is required'
            });
        }

        console.log('[Steam Games API] Fetching games for user:', username);
        
        // Get user from database using User model to ensure we have Sequelize instance
        const dbUser = await User.findOne({ where: { username: username } });
        
        if (!dbUser) {
            console.error('[Steam Games API] User not found:', username);
            return res.status(404).json({ 
                success: false,
                error: 'User not found',
                message: `User "${username}" not found`
            });
        }

        // Extract steam_id from Sequelize instance - try multiple methods
        let steamId = null;
        
        // Try multiple ways to get steam_id
        if (dbUser.steam_id) {
            steamId = dbUser.steam_id;
        } else if (dbUser.getDataValue && dbUser.getDataValue('steam_id')) {
            steamId = dbUser.getDataValue('steam_id');
        } else if (dbUser.dataValues && dbUser.dataValues.steam_id) {
            steamId = dbUser.dataValues.steam_id;
        } else if (dbUser.toJSON && dbUser.toJSON().steam_id) {
            steamId = dbUser.toJSON().steam_id;
        }
        
        console.log('[Steam Games API] Steam ID extraction:', {
            direct: dbUser.steam_id,
            getDataValue: dbUser.getDataValue ? dbUser.getDataValue('steam_id') : 'N/A',
            dataValues: dbUser.dataValues ? dbUser.dataValues.steam_id : 'N/A',
            final: steamId
        });
        
        if (!steamId) {
            console.error('[Steam Games API] No Steam account linked for user:', username);
            console.error('[Steam Games API] User object keys:', Object.keys(dbUser));
            console.error('[Steam Games API] User raw values:', {
                username: dbUser.username,
                email: dbUser.email,
                has_steam_profile: !!dbUser.steam_profile,
                steam_profile_type: typeof dbUser.steam_profile
            });
            
            // Try to get from session as fallback
            if (req.session.user && req.session.user.username === username && req.session.user.steam_id) {
                console.log('[Steam Games API] Using Steam ID from session as fallback:', req.session.user.steam_id);
                steamId = req.session.user.steam_id;
            } else {
                return res.status(400).json({ 
                    success: false,
                    error: 'No Steam account linked',
                    message: 'No Steam account linked for this user. Please connect your Steam account first.'
                });
            }
        }

        console.log('[Steam Games API] User has Steam ID:', steamId);
        
        // Extract steam_games and steam_last_sync from Sequelize instance
        const steamGames = dbUser.steam_games || dbUser.getDataValue?.('steam_games') || dbUser.dataValues?.steam_games || null;
        const steamLastSync = dbUser.steam_last_sync || dbUser.getDataValue?.('steam_last_sync') || dbUser.dataValues?.steam_last_sync;
        
        // Parse steam_games if it's a string
        let parsedGames = null;
        if (steamGames) {
            if (typeof steamGames === 'string') {
                try {
                    parsedGames = JSON.parse(steamGames);
                } catch (e) {
                    console.error('[Steam Games API] Error parsing steam_games:', e);
                    parsedGames = null;
                }
            } else if (Array.isArray(steamGames)) {
                parsedGames = steamGames;
            }
        }

        // Return cached games if available and recent (less than 24 hours old)
        if (parsedGames && Array.isArray(parsedGames) && parsedGames.length > 0 && steamLastSync) {
            const hoursSinceSync = (new Date() - new Date(steamLastSync)) / (1000 * 60 * 60);
            if (hoursSinceSync < 24) {
                console.log('[Steam Games API] Returning cached games:', parsedGames.length, 'games');
                return res.json({
                    success: true,
                    games: parsedGames,
                    game_count: parsedGames.length,
                    cached: true,
                    last_sync: steamLastSync
                });
            }
        }

        // Fetch fresh games from Steam API
        console.log('[Steam Games API] Fetching fresh games from Steam API...');
        const result = await steamService.getUserGameLibrary(steamId);
        
        if (result.success) {
            // Update user's games in database
            dbUser.steam_games = result.games;
            dbUser.steam_last_sync = new Date();
            await dbUser.save();
            
            console.log('[Steam Games API] Games saved to database:', result.games.length);
        }

        res.json(result);
    } catch (error) {
        console.error('[Steam Games API] ==========================================');
        console.error('[Steam Games API] Error fetching Steam games:', error);
        console.error('[Steam Games API] Error message:', error.message);
        console.error('[Steam Games API] Error stack:', error.stack);
        console.error('[Steam Games API] ==========================================');
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch Steam games',
            message: 'Failed to fetch Steam games: ' + error.message
        });
    }
});

app.post('/api/steam/sync/:username?', async (req, res) => {
    try {
        console.log('[Steam Sync] ==========================================');
        console.log('[Steam Sync] Sync request received');
        console.log('[Steam Sync] URL params:', req.params);
        console.log('[Steam Sync] Session user:', req.session.user ? req.session.user.username : 'none');
        console.log('[Steam Sync] Request body:', req.body);
        
        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            console.error('[Steam Sync] No username provided');
            console.error('[Steam Sync] Params:', req.params);
            console.error('[Steam Sync] Session:', req.session.user);
            return res.status(400).json({ 
                success: false,
                error: 'Username required',
                message: 'Username is required. Please make sure you are logged in or provide a username in the URL.'
            });
        }

        console.log('[Steam Sync] Syncing for user:', username);
        
        // Get user from database using User model (not profileManager) to ensure we have Sequelize instance
        let dbUser;
        try {
            dbUser = await User.findOne({ where: { username: username } });
        } catch (dbError) {
            console.error('[Steam Sync] Database error finding user:', dbError.message);
            console.error('[Steam Sync] Error stack:', dbError.stack);
            return res.status(500).json({ 
                success: false,
                error: 'Database error',
                message: 'Failed to find user in database: ' + dbError.message
            });
        }
        
        if (!dbUser) {
            console.error('[Steam Sync] User not found:', username);
            return res.status(404).json({ 
                success: false,
                error: 'User not found',
                message: `User "${username}" not found in database.`
            });
        }

        console.log('[Steam Sync] User found:', {
            username: dbUser.username,
            steam_id: dbUser.steam_id,
            has_steam_id: !!dbUser.steam_id
        });

        if (!dbUser.steam_id) {
            console.error('[Steam Sync] No Steam account linked for user:', username);
            return res.status(400).json({ 
                success: false,
                error: 'No Steam account linked',
                message: 'No Steam account linked. Please connect your Steam account first by clicking "Connect Your Steam Account".'
            });
        }

        console.log('[Steam Sync] User has Steam ID:', dbUser.steam_id);
        console.log('[Steam Sync] Steam API key configured:', !!(process.env.STEAM_API_KEY && process.env.STEAM_API_KEY !== 'your-steam-api-key-here'));
        console.log('[Steam Sync] Steam API key value (first 10 chars):', process.env.STEAM_API_KEY ? process.env.STEAM_API_KEY.substring(0, 10) + '...' : 'not set');

        console.log('[Steam Sync] Calling steamService.syncUserGames...');
        const syncResult = await steamService.syncUserGames(dbUser);
        
        console.log('[Steam Sync] Sync result:', {
            success: syncResult.success,
            gamesCount: syncResult.gamesCount,
            totalPlaytime: syncResult.totalPlaytime,
            totalAchievements: syncResult.totalAchievements,
            error: syncResult.error,
            message: syncResult.message
        });
        
        if (syncResult.success) {
            // Reload user from database to get fresh data
            const updatedDbUser = await User.findOne({ where: { username: username } });
            
            if (!updatedDbUser) {
                console.error('[Steam Sync] Failed to reload user after sync');
                return res.status(500).json({ error: 'Failed to reload user data after sync' });
            }
            
            // Extract values from Sequelize instance
            const updatedStatistics = updatedDbUser.statistics || updatedDbUser.getDataValue?.('statistics') || updatedDbUser.dataValues?.statistics || {};
            const updatedSteamGames = updatedDbUser.steam_games || updatedDbUser.getDataValue?.('steam_games') || updatedDbUser.dataValues?.steam_games || [];
            const updatedLastSync = updatedDbUser.steam_last_sync || updatedDbUser.getDataValue?.('steam_last_sync') || updatedDbUser.dataValues?.steam_last_sync;
            
            if (req.session.user && req.session.user.username === username) {
                req.session.user.statistics = updatedStatistics;
                req.session.user.steam_games = updatedSteamGames;
                req.session.user.steam_last_sync = updatedLastSync;
                
                console.log('[Steam Sync] Session updated with new Steam data:', {
                    gamesCount: Array.isArray(updatedSteamGames) ? updatedSteamGames.length : 0,
                    statistics: updatedStatistics
                });
            }
            
            res.json({ 
                success: true, 
                message: `Steam library synced successfully - ${syncResult.gamesCount} games imported`,
                gamesCount: syncResult.gamesCount,
                totalPlaytime: syncResult.totalPlaytime,
                totalAchievements: syncResult.totalAchievements,
                statistics: updatedStatistics
            });
        } else {
            console.error('[Steam Sync] ==========================================');
            console.error('[Steam Sync] Sync failed!');
            console.error('[Steam Sync] Error:', syncResult.error);
            console.error('[Steam Sync] Full result:', JSON.stringify(syncResult, null, 2));
            console.error('[Steam Sync] ==========================================');
            
            res.status(400).json({ 
                success: false,
                error: syncResult.error || 'Failed to sync Steam library',
                message: syncResult.error || 'Failed to sync Steam library. Please check server logs for details.',
                details: syncResult.error
            });
        }
    } catch (error) {
        console.error('[Steam Sync] ==========================================');
        console.error('[Steam Sync] Exception caught in sync endpoint!');
        console.error('[Steam Sync] Error message:', error.message);
        console.error('[Steam Sync] Error stack:', error.stack);
        console.error('[Steam Sync] ==========================================');
        
        res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            message: 'Failed to sync Steam library: ' + error.message,
            details: error.stack
        });
    }
});

app.get('/api/steam/games/:appId/achievements', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user.steam_id) {
            return res.status(401).json({ error: 'Steam account not linked' });
        }

        const { appId } = req.params;
        const achievementsResult = await steamService.getUserAchievements(req.session.user.steam_id, appId);
        if (achievementsResult.success) {
            res.json({ success: true, achievements: achievementsResult.achievements });
        } else {
            res.status(400).json({ error: achievementsResult.error });
        }
    } catch (error) {
        console.error('Error fetching Steam achievements:', error);
        res.status(500).json({ error: 'Failed to fetch Steam achievements' });
    }
});

app.get('/api/steam/game/:appId', async (req, res) => {
    try {
        const { appId } = req.params;
        const gameResult = await steamService.getGameDetails(appId);
        if (gameResult.success) {
            res.json({ success: true, game: gameResult.game });
        } else {
            res.status(400).json({ error: gameResult.error });
        }
    } catch (error) {
        console.error('Error fetching Steam game details:', error);
        res.status(500).json({ error: 'Failed to fetch Steam game details' });
    }
});

app.get('/api/reviews/current-user', async (req, res) => {
    try {
        // Try to restore session if missing
        if (!req.session?.user) {
            // Try to get username from query or referer
            const referer = req.headers.referer || '';
            const pathMatch = referer.match(/\/profile\/([^\/]+)/);
            const username = pathMatch ? pathMatch[1] : null;
            
            const restoredUser = await restoreSessionUser(req, username);
            if (!restoredUser) {
            return res.status(401).json({ error: 'User not logged in' });
            }
        }

        const sessionUsername = req.session.user.username;
        if (!sessionUsername) {
            return res.status(401).json({ error: 'Username not found in session' });
        }

        const user = await profileManager.getUserByUsername(sessionUsername);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        profileManager.loadProfile(req.session.user.username);
        const reviewManager = profileManager.getReviewManager();
        
        if (reviewManager) {
            const reviews = reviewManager.getReviews();
            const reviewIds = reviews.map(review => review.id);
            let userVotes = [];
            if (reviewIds.length > 0) {
                userVotes = await ReviewHelpfulVote.findAll({
                    where: {
                        reviewId: reviewIds,
                        userId: req.session.user.id
                    }
                });
            }
            const votedSet = new Set(userVotes.map(vote => vote.reviewId));
            const enrichedReviews = reviews.map(review => ({
                ...review,
                userHasVoted: votedSet.has(review.id)
            }));
            res.json({ success: true, reviews: enrichedReviews });
        } else {
            res.json({ success: true, reviews: [] });
        }
    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({ error: 'Failed to fetch user reviews' });
    }
});

app.get('/api/test/users', async (req, res) => {
    try {
        if (!profileManager.isInitialized) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        
        const users = await profileManager.getAllUsers();
        res.json({ users: users.map(u => ({ username: u.username, email: u.email })) });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

app.get('/api/profile/:username', async (req, res) => {
    try {
    const { username } = req.params;
        
        // Get user from database
        const user = await profileManager.getUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Extract user data from Sequelize instance
        const profile = {
            username: user.username || user.getDataValue?.('username') || user.dataValues?.username,
            email: user.email || user.getDataValue?.('email') || user.dataValues?.email,
            joinDate: user.joinDate || user.getDataValue?.('join_date') || user.dataValues?.join_date,
            bio: user.bio || user.getDataValue?.('bio') || user.dataValues?.bio || '',
            gamingPreferences: user.gamingPreferences || user.getDataValue?.('gaming_preferences') || user.dataValues?.gaming_preferences || {},
            statistics: user.statistics || user.getDataValue?.('statistics') || user.dataValues?.statistics || {},
            achievements: user.achievements || user.getDataValue?.('achievements') || user.dataValues?.achievements || []
        };

        res.json(profile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.put('/api/profile/:username', async (req, res) => {
    try {
    const { username } = req.params;
    const updates = req.body;

        // Touch session to keep it alive
        if (req.session) {
            req.session.touch();
        }
        
        // Log session state for debugging
        console.log('[Profile Update] ========== START ==========');
        console.log('[Profile Update] Session check:', {
            hasSession: !!req.session,
            hasUser: !!req.session?.user,
            sessionUsername: req.session?.user?.username,
            requestedUsername: username,
            sessionID: req.sessionID,
            cookies: req.headers.cookie ? 'present' : 'missing'
        });
        console.log('[Profile Update] Full session object:', req.session ? Object.keys(req.session) : 'no session');
        console.log('[Profile Update] Session user object:', req.session?.user);
        
        // Check if user is logged in - try multiple ways to get session user
        let sessionUser = req.session?.user;
        
        // If no session user but we have a session ID, try to reload the session
        if (!sessionUser && req.sessionID && req.session) {
            console.log('[Profile Update] No session user, but session ID exists:', req.sessionID);
            console.log('[Profile Update] Attempting to reload session...');
            
            // Try to reload session from store (wrapped in promise for async/await)
            try {
                await new Promise((resolve, reject) => {
                    req.session.reload((err) => {
                        if (err) {
                            console.error('[Profile Update] Session reload error:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
                
                sessionUser = req.session?.user;
                if (sessionUser) {
                    console.log('[Profile Update] Session reloaded successfully, found user:', sessionUser.username);
                } else {
                    console.error('[Profile Update] Session reloaded but still no user');
                }
            } catch (reloadError) {
                console.error('[Profile Update] Session reload failed:', reloadError);
                console.log('[Profile Update] This might indicate the server was restarted and session was lost');
            }
        }
        
        // If no session user, try to restore from database using the username from the request
        // This is a fallback in case the session was lost but the user is still authenticated
        if (!sessionUser) {
            console.warn('[Profile Update] No session user found, attempting to restore from database...');
            
            try {
                // Try to find the user in the database
                const dbUser = await User.findOne({ where: { username: username } });
                if (dbUser) {
                    console.log('[Profile Update] Found user in database, restoring session...');
                    // Restore session user from database
                    req.session.user = {
                        id: dbUser.id,
                        username: dbUser.username,
                        email: dbUser.email,
                        joinDate: dbUser.join_date,
                        bio: dbUser.bio,
                        gamingPreferences: dbUser.gaming_preferences || {},
                        statistics: dbUser.statistics || {},
                        achievements: dbUser.achievements || [],
                        steam_id: dbUser.steam_id,
                        steam_profile: dbUser.steam_profile,
                        steam_games: dbUser.steam_games,
                        steam_last_sync: dbUser.steam_last_sync,
                        avatar_path: dbUser.avatar_path
                    };
                    
                    // Save the restored session
                    req.session.save((err) => {
                        if (err) {
                            console.error('[Profile Update] Error saving restored session:', err);
                        } else {
                            console.log('[Profile Update] Session restored and saved successfully');
                        }
                    });
                    
                    sessionUser = req.session.user;
                    console.log('[Profile Update] Session user restored from database:', sessionUser.username);
                } else {
                    console.error('[Profile Update] User not found in database:', username);
                    console.log('[Profile Update] Session exists:', !!req.session);
                    console.log('[Profile Update] Session ID:', req.sessionID);
                    console.log('[Profile Update] Session keys:', req.session ? Object.keys(req.session) : 'no session');
                    console.log('[Profile Update] Cookie header:', req.headers.cookie ? 'present' : 'missing');
                    if (req.headers.cookie) {
                        const cookiePreview = req.headers.cookie.length > 100 
                            ? req.headers.cookie.substring(0, 100) + '...' 
                            : req.headers.cookie;
                        console.log('[Profile Update] Cookie value:', cookiePreview);
                    }
                    console.log('[Profile Update] ========== END (NO USER) ==========');
                    return res.status(401).json({ error: 'Unauthorized - please log in to update your profile' });
                }
            } catch (dbError) {
                console.error('[Profile Update] Error querying database for user:', dbError);
                console.log('[Profile Update] ========== END (DB ERROR) ==========');
                return res.status(401).json({ error: 'Unauthorized - please log in to update your profile' });
            }
        }
        
        // Get session username with fallbacks
        const sessionUsername = sessionUser.username ||
                               sessionUser.getDataValue?.('username') || 
                               sessionUser.dataValues?.username;
        
        console.log('[Profile Update] Session username:', sessionUsername);
        console.log('[Profile Update] Requested username:', username);
        
        // Compare usernames (case-insensitive for safety)
        if (!sessionUsername || sessionUsername.toLowerCase() !== username.toLowerCase()) {
            console.error('[Profile Update] Username mismatch:', {
                sessionUsername: sessionUsername,
                requestedUsername: username
            });
            console.log('[Profile Update] ========== END (USERNAME MISMATCH) ==========');
            return res.status(401).json({ error: 'Unauthorized - can only update your own profile' });
        }
        
        // Ensure session is saved before proceeding
        req.session.save((err) => {
            if (err) {
                console.error('[Profile Update] Error saving session before update:', err);
            } else {
                console.log('[Profile Update] Session saved before update');
            }
        });

    if (!profileManager.isInitialized) {
        return res.status(503).json({ error: 'Database not ready yet, please try again' });
    }

        // Get user from database
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user fields
        if (updates.bio !== undefined) {
            user.bio = updates.bio;
        }
        if (updates.gamingPreferences !== undefined) {
            user.gaming_preferences = updates.gamingPreferences;
        }

        await user.save();

        // Update session with fresh data from database
        if (req.session.user) {
            // Reload user data to ensure we have the latest
            const updatedUser = await User.findOne({ where: { username } });
            if (updatedUser) {
                req.session.user.bio = updatedUser.bio || updatedUser.getDataValue?.('bio') || updatedUser.dataValues?.bio || '';
                req.session.user.gamingPreferences = updatedUser.gaming_preferences || updatedUser.getDataValue?.('gaming_preferences') || updatedUser.dataValues?.gaming_preferences || {};
                req.session.user.email = updatedUser.email || updatedUser.getDataValue?.('email') || updatedUser.dataValues?.email || req.session.user.email;
                req.session.user.username = updatedUser.username || updatedUser.getDataValue?.('username') || updatedUser.dataValues?.username || req.session.user.username;
            } else {
                // Fallback to what we just saved
            req.session.user.bio = user.bio;
            req.session.user.gamingPreferences = user.gaming_preferences;
            }
            
            // Save session to persist changes
            req.session.save((err) => {
                if (err) {
                    console.error('[Profile Update] Error saving session:', err);
                } else {
                    console.log('[Profile Update] Session updated and saved successfully');
                }
            });
        }

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Friends routes - Enhanced with database integration
app.get('/api/friends/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        // Restore session if missing
        if (!req.session?.user) {
            const restoredUser = await restoreSessionUser(req, username);
            if (!restoredUser) {
                return res.status(401).json({ error: 'Authentication required' });
            }
        }
        
        // Get user from database
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Extract user_id properly
        const userId = user.user_id || user.getDataValue?.('user_id') || user.dataValues?.user_id || user.id || null;
        if (!userId) {
            console.error('[Friends API] Could not extract user_id from user:', username);
            return res.status(500).json({ error: 'Failed to extract user ID' });
        }

        // Get accepted friendships (friends)
        const friends = await profileManager.getFriendships(userId, 'accepted');
        
        // Get pending requests (both sent and received)
        const sentRequests = await profileManager.getSentFriendRequests(userId);
        const receivedRequests = await profileManager.getReceivedFriendRequests(userId);

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

        // Extract user IDs properly
        const userId = user.user_id || user.getDataValue?.('user_id') || user.dataValues?.user_id || user.id || null;
        const friendId = friend.user_id || friend.getDataValue?.('user_id') || friend.dataValues?.user_id || friend.id || null;
        
        if (!userId || !friendId) {
            console.error('[Friend Request] Could not extract user IDs:', { userId, friendId });
            return res.status(500).json({ error: 'Failed to extract user IDs' });
        }

        // Check if friendship already exists
        const existingFriendship = await profileManager.getFriendship(userId, friendId);
        if (existingFriendship) {
            return res.status(400).json({ error: 'Friendship already exists or request already sent' });
        }

        // Create friend request
        const friendship = await profileManager.createFriendRequest(userId, friendId);
        
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

        // Extract user_id properly
        const userId = user.user_id || user.getDataValue?.('user_id') || user.dataValues?.user_id || user.id || null;
        if (!userId) {
            console.error('[Accept Friend Request] Could not extract user_id from user:', username);
            return res.status(500).json({ error: 'Failed to extract user ID' });
        }

        const friendship = await profileManager.acceptFriendRequest(parseInt(requestId), userId);
        
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

        // Extract user_id properly
        const userId = user.user_id || user.getDataValue?.('user_id') || user.dataValues?.user_id || user.id || null;
        if (!userId) {
            console.error('[Decline Friend Request] Could not extract user_id from user:', username);
            return res.status(500).json({ error: 'Failed to extract user ID' });
        }

        const success = await profileManager.declineFriendRequest(parseInt(requestId), userId);
        
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

// Upload profile avatar
app.post('/api/profile/avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const user = await User.findOne({ where: { username: req.session.user.username } });
        
        if (!user) {
            // Delete uploaded file if user not found
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete old avatar if it exists
        if (user.avatar_path) {
            const oldAvatarPath = path.join(__dirname, 'public', user.avatar_path);
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        // Save new avatar path (relative to public folder)
        const avatarPath = `/uploads/avatars/${req.file.filename}`;
        user.avatar_path = avatarPath;
        await user.save();

        // Update session
        req.session.user.avatar_path = avatarPath;
        req.session.save();

            res.json({
                success: true,
            message: 'Avatar uploaded successfully',
            avatar_path: avatarPath
            });
    } catch (error) {
        console.error('Error uploading avatar:', error);
        // Delete uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload avatar: ' + error.message });
    }
});

app.delete('/api/friends/:username/remove/:friendId', async (req, res) => {
    try {
        const { username, friendId } = req.params;
        
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Extract user_id properly
        const userId = user.user_id || user.getDataValue?.('user_id') || user.dataValues?.user_id || user.id || null;
        if (!userId) {
            console.error('[Remove Friend] Could not extract user_id from user:', username);
            return res.status(500).json({ error: 'Failed to extract user ID' });
        }

        const success = await profileManager.removeFriend(userId, parseInt(friendId));
        
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

app.get('/api/wishlists/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        console.log(`[Get Libraries] Request for username: ${username}`);
        
        // Restore session if missing
        if (!req.session?.user) {
            const restoredUser = await restoreSessionUser(req, username);
            if (!restoredUser) {
                return res.status(401).json({ 
                    success: false,
                    error: 'Authentication required',
                    wishlists: []
                });
            }
        }
        
        console.log(`[Get Libraries] Session user:`, req.session.user);
        
        // Use session user ID if available - try both 'id' and 'user_id'
        let userId = req.session?.user?.id || req.session?.user?.user_id || null;

        // Get user from database if we don't have ID - use direct User model query instead of profileManager
        let user = null;
        if (!userId) {
            // Try direct User model query first (more reliable)
            try {
                user = await User.findOne({ where: { username: username } });
        if (!user) {
                    console.error(`[Get Libraries] User not found in database: ${username}`);
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
                }
            } catch (dbError) {
                console.error(`[Get Libraries] Database error finding user:`, dbError);
                return res.status(500).json({ 
                    success: false,
                    error: 'Database error' 
                });
            }
        }

        // Extract user ID - try multiple methods if not from session
        if (!userId && user) {
            console.log(`[Get Libraries] Extracting user ID from database user object...`);
            console.log(`[Get Libraries] User object type:`, user.constructor?.name);
            console.log(`[Get Libraries] User has getDataValue:`, typeof user.getDataValue === 'function');
            console.log(`[Get Libraries] User has toJSON:`, typeof user.toJSON === 'function');
            
            // Method 1: Try 'user_id' first (primary key in database)
            if (user.user_id !== undefined && user.user_id !== null) {
                userId = user.user_id;
                console.log(`[Get Libraries] Found user_id via direct property: ${userId}`);
            }
            
            // Method 2: Use getDataValue for 'user_id' (Sequelize method)
            if (!userId && user.getDataValue && typeof user.getDataValue === 'function') {
            try {
                userId = user.getDataValue('user_id');
                    if (userId) {
                        console.log(`[Get Libraries] Found user_id via getDataValue: ${userId}`);
                    }
            } catch (e) {
                console.warn(`[Get Libraries] getDataValue('user_id') failed:`, e.message);
            }
        }
        
            // Method 3: Check dataValues directly for 'user_id'
        if (!userId && user.dataValues && user.dataValues.user_id !== undefined && user.dataValues.user_id !== null) {
            userId = user.dataValues.user_id;
                console.log(`[Get Libraries] Found user_id via dataValues: ${userId}`);
            }
            
            // Method 4: Try 'id' (might be mapped)
            if (!userId && user.id !== undefined && user.id !== null) {
                userId = user.id;
                console.log(`[Get Libraries] Found id via direct property: ${userId}`);
            }
            
            // Method 5: Use getDataValue for 'id'
            if (!userId && user.getDataValue && typeof user.getDataValue === 'function') {
                try {
                    userId = user.getDataValue('id');
                    if (userId) {
                        console.log(`[Get Libraries] Found id via getDataValue: ${userId}`);
                    }
                } catch (e) {
                    // Ignore
                }
            }
            
            // Method 6: Check dataValues directly for 'id'
            if (!userId && user.dataValues && user.dataValues.id !== undefined && user.dataValues.id !== null) {
                userId = user.dataValues.id;
                console.log(`[Get Libraries] Found id via dataValues: ${userId}`);
            }
            
            // Method 7: Use toJSON() to convert to plain object
        if (!userId && user.toJSON && typeof user.toJSON === 'function') {
            try {
                const plain = user.toJSON();
                if (plain && plain.user_id !== undefined && plain.user_id !== null) {
                    userId = plain.user_id;
                        console.log(`[Get Libraries] Found user_id via toJSON: ${userId}`);
                    } else if (plain && plain.id !== undefined && plain.id !== null) {
                        userId = plain.id;
                        console.log(`[Get Libraries] Found id via toJSON: ${userId}`);
                }
            } catch (e) {
                console.warn(`[Get Libraries] toJSON() failed:`, e.message);
            }
        }
        
            // Method 8: Fallback - raw query if all else fails
        if (!userId) {
            console.warn(`[Get Libraries] All extraction methods failed, trying raw query...`);
            try {
                const results = await sequelize.query(
                    `SELECT user_id FROM users WHERE username = :username LIMIT 1`,
                    {
                        replacements: { username },
                        type: QueryTypes.SELECT
                    }
                );
                
                // QueryTypes.SELECT returns an array of objects directly
                    if (results && Array.isArray(results) && results.length > 0 && results[0]) {
                    userId = results[0].user_id;
                        if (userId) {
                    console.log(`[Get Libraries] Successfully retrieved user_id via raw query: ${userId}`);
                        }
                }
            } catch (rawError) {
                console.error(`[Get Libraries] Raw query also failed:`, rawError.message);
                }
            }
        }
        
        if (!userId) {
            console.error(`[Get Libraries] User ID extraction failed. Session user:`, req.session?.user);
            return res.status(500).json({ 
                success: false,
                error: 'Invalid user data - could not extract user ID' 
            });
        }

        console.log(`[Get Libraries] User found: ${username}, user_id: ${userId}, ensuring default libraries exist...`);
        
        // Ensure default libraries exist
        try {
            await profileManager.databaseManager.createDefaultLibraries(userId);
            console.log(`[Get Libraries] Default libraries ensured`);
        } catch (defaultLibError) {
            console.error(`[Get Libraries] Error creating default libraries:`, defaultLibError);
            // Continue anyway - might already exist
        }

        // Get all libraries for the user
        console.log(`[Get Libraries] Fetching libraries for user ${userId}...`);
        const wishlists = await profileManager.databaseManager.getUserWishlists(userId);
        console.log(`[Get Libraries] Found ${wishlists.length} libraries`);

        // Format libraries for response
        const formattedWishlists = await Promise.all(wishlists.map(async (wishlist) => {
            try {
            const games = await profileManager.databaseManager.getWishlistGames(wishlist.id);
            return {
                id: wishlist.id,
                name: wishlist.name,
                    description: wishlist.description || '',
                gameCount: games.length,
                createdDate: wishlist.createdAt,
                    isPublic: wishlist.isPublic || false,
                    priority: wishlist.priority || 'medium',
                    type: wishlist.type || 'custom'
                };
            } catch (gameError) {
                console.error(`[Get Libraries] Error getting games for library ${wishlist.id}:`, gameError);
                return {
                    id: wishlist.id,
                    name: wishlist.name,
                    description: wishlist.description || '',
                    gameCount: 0,
                    createdDate: wishlist.createdAt,
                    isPublic: wishlist.isPublic || false,
                    priority: wishlist.priority || 'medium',
                    type: wishlist.type || 'custom'
                };
            }
        }));

        // Sort by type: automatic, wishlist, custom
        formattedWishlists.sort((a, b) => {
            const typeOrder = { 'automatic': 0, 'wishlist': 1, 'custom': 2 };
            return (typeOrder[a.type] || 2) - (typeOrder[b.type] || 2);
        });

        console.log(`[Get Libraries] Returning ${formattedWishlists.length} libraries`);

        res.json({
            success: true,
            wishlists: formattedWishlists
        });
    } catch (error) {
        console.error('[Get Libraries] Error getting libraries:', error);
        console.error('[Get Libraries] Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to get libraries',
            wishlists: []
        });
    }
});

app.post('/api/wishlists/:username/create', async (req, res) => {
    try {
        const { username } = req.params;
        const { name, description, isPublic, priority } = req.body;

        console.log(`[Create Library] Request from user: ${username}, library name: ${name}`);

        if (!name) {
            return res.status(400).json({ error: 'Library name is required' });
        }

        // Restore session if missing
        if (!req.session?.user) {
            const restoredUser = await restoreSessionUser(req, username);
            if (!restoredUser) {
                return res.status(401).json({ error: 'Authentication required' });
            }
        }

        // Use session user ID if available, otherwise get from database
        let userId = req.session?.user?.id || null;

        // Get user from database if we don't have ID
        const user = userId ? null : await profileManager.getUserByUsername(username);
        if (!userId && !user) {
            console.error(`[Create Library] User not found: ${username}`);
            return res.status(404).json({ error: 'User not found. Please log in and try again.' });
        }

        // Extract user ID - try multiple methods (same as other routes) if not from session
        if (!userId && user) {
        if (user.getDataValue && typeof user.getDataValue === 'function') {
            try {
                userId = user.getDataValue('user_id');
            } catch (e) {
                console.warn(`[Create Library] getDataValue('user_id') failed:`, e.message);
            }
        }
        
        if (!userId && user.dataValues && user.dataValues.user_id !== undefined && user.dataValues.user_id !== null) {
            userId = user.dataValues.user_id;
        }
        
        if (!userId && user.user_id !== undefined && user.user_id !== null) {
            userId = user.user_id;
        }
        
        if (!userId && user.toJSON && typeof user.toJSON === 'function') {
            try {
                const plain = user.toJSON();
                if (plain && plain.user_id !== undefined && plain.user_id !== null) {
                    userId = plain.user_id;
                }
            } catch (e) {
                console.warn(`[Create Library] toJSON() failed:`, e.message);
                }
            }
            
            if (!userId && user.id !== undefined && user.id !== null) {
                userId = user.id;
            }
        }
        
        if (!userId) {
            console.error(`[Create Library] User ID extraction failed. Session user:`, req.session?.user);
            return res.status(500).json({ error: 'Invalid user data - could not extract user ID' });
        }

        console.log(`[Create Library] User found: ${username}, user_id: ${userId}, creating library...`);

        // Create library in database
        const wishlist = await profileManager.databaseManager.createWishlist({
            userId: userId,
            name: name,
            description: description || '',
            isPublic: isPublic || false,
            priority: priority || 'medium',
            type: 'custom'  // User-created libraries are always custom
        });

        console.log(`[Create Library] Library created successfully: ${wishlist.id}`);

        res.json({
            success: true,
            wishlist: {
                id: wishlist.id,
                name: wishlist.name,
                description: wishlist.description,
                gameCount: 0,
                createdDate: wishlist.createdAt,
                isPublic: wishlist.isPublic,
                priority: wishlist.priority,
                type: wishlist.type || 'custom'
            }
        });
    } catch (error) {
        console.error('[Create Library] Error creating library:', error);
        console.error('[Create Library] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to create library';
        if (error.name === 'SequelizeConnectionError' || error.message.includes('connection')) {
            errorMessage = 'Database connection failed. Please try again.';
        } else if (error.message) {
            errorMessage = `Failed to create library: ${error.message}`;
        }
        
        res.status(500).json({ error: errorMessage });
    }
});

// Get individual wishlist with games
app.get('/api/wishlists/:username/:wishlistId', async (req, res) => {
    try {
        const { username, wishlistId } = req.params;
        
        console.log(`[Get Library] Request for username: ${username}, library ID: ${wishlistId}`);
        
        // Restore session if missing
        if (!req.session?.user) {
            const restoredUser = await restoreSessionUser(req, username);
            if (!restoredUser) {
                return res.status(401).json({ error: 'Authentication required' });
            }
        }
        
        // Use session user ID if available - try both 'id' and 'user_id'
        let userId = req.session?.user?.id || req.session?.user?.user_id || null;

        // Get user from database if we don't have ID - use direct User model query
        let user = null;
        if (!userId) {
            try {
                user = await User.findOne({ where: { username: username } });
        if (!user) {
                    console.error(`[Get Library] User not found in database: ${username}`);
            return res.status(404).json({ error: 'User not found' });
                }
            } catch (dbError) {
                console.error(`[Get Library] Database error finding user:`, dbError);
                return res.status(500).json({ error: 'Database error' });
            }
        }

        // Extract user ID - try multiple methods if not from session
        if (!userId && user) {
            console.log(`[Get Library] Extracting user ID from database user object...`);
            
            // Method 1: Try 'user_id' first (primary key in database)
            if (user.user_id !== undefined && user.user_id !== null) {
                userId = user.user_id;
                console.log(`[Get Library] Found user_id via direct property: ${userId}`);
            }
            
            // Method 2: Use getDataValue for 'user_id' (Sequelize method)
            if (!userId && user.getDataValue && typeof user.getDataValue === 'function') {
            try {
                userId = user.getDataValue('user_id');
                    if (userId) {
                        console.log(`[Get Library] Found user_id via getDataValue: ${userId}`);
                    }
            } catch (e) {
                    console.warn(`[Get Library] getDataValue('user_id') failed:`, e.message);
            }
        }
        
            // Method 3: Check dataValues directly for 'user_id'
        if (!userId && user.dataValues && user.dataValues.user_id !== undefined && user.dataValues.user_id !== null) {
            userId = user.dataValues.user_id;
                console.log(`[Get Library] Found user_id via dataValues: ${userId}`);
            }
            
            // Method 4: Try 'id' (might be mapped)
            if (!userId && user.id !== undefined && user.id !== null) {
                userId = user.id;
                console.log(`[Get Library] Found id via direct property: ${userId}`);
            }
            
            // Method 5: Use getDataValue for 'id'
            if (!userId && user.getDataValue && typeof user.getDataValue === 'function') {
                try {
                    userId = user.getDataValue('id');
                    if (userId) {
                        console.log(`[Get Library] Found id via getDataValue: ${userId}`);
                    }
                } catch (e) {
                    // Ignore
                }
            }
            
            // Method 6: Check dataValues directly for 'id'
            if (!userId && user.dataValues && user.dataValues.id !== undefined && user.dataValues.id !== null) {
                userId = user.dataValues.id;
                console.log(`[Get Library] Found id via dataValues: ${userId}`);
            }
            
            // Method 7: Use toJSON() to convert to plain object
        if (!userId && user.toJSON && typeof user.toJSON === 'function') {
            try {
                const plain = user.toJSON();
                if (plain && plain.user_id !== undefined && plain.user_id !== null) {
                    userId = plain.user_id;
                        console.log(`[Get Library] Found user_id via toJSON: ${userId}`);
                    } else if (plain && plain.id !== undefined && plain.id !== null) {
                        userId = plain.id;
                        console.log(`[Get Library] Found id via toJSON: ${userId}`);
                }
            } catch (e) {
                    console.warn(`[Get Library] toJSON() failed:`, e.message);
            }
        }
        
            // Method 8: Fallback - raw query if all else fails
        if (!userId) {
                console.warn(`[Get Library] All extraction methods failed, trying raw query...`);
                try {
                    const results = await sequelize.query(
                        `SELECT user_id FROM users WHERE username = :username LIMIT 1`,
                        {
                            replacements: { username },
                            type: QueryTypes.SELECT
                        }
                    );
                    
                    if (results && Array.isArray(results) && results.length > 0 && results[0]) {
                        userId = results[0].user_id;
                        if (userId) {
                            console.log(`[Get Library] Successfully retrieved user_id via raw query: ${userId}`);
                        }
                    }
                } catch (rawError) {
                    console.error(`[Get Library] Raw query also failed:`, rawError.message);
                }
            }
        }
        
        if (!userId) {
            console.error(`[Get Library] User ID extraction failed. Session user:`, req.session?.user);
            return res.status(500).json({ error: 'Invalid user data - could not extract user ID' });
        }

        // Get wishlist from database
        const wishlist = await Wishlist.findOne({
            where: { id: wishlistId, userId: userId }
        });

        if (!wishlist) {
            return res.status(404).json({ error: 'Library not found' });
        }

        // Get games in library
        const games = await profileManager.databaseManager.getWishlistGames(wishlistId);

        res.json({
            success: true,
            wishlist: {
                id: wishlist.id,
                name: wishlist.name,
                description: wishlist.description,
                createdDate: wishlist.createdAt,
                isPublic: wishlist.isPublic,
                priority: wishlist.priority,
                type: wishlist.type || 'custom'
            },
            games: games.map(game => {
                const steamId = game.steamId || game.steam_id || game.getDataValue?.('steamId') || game.dataValues?.steamId || game.gameId;
                
                // Try to extract backgroundImage from notes if stored there
                let backgroundImage = null;
                if (game.notes) {
                    try {
                        const notesObj = JSON.parse(game.notes);
                        if (notesObj.backgroundImage) {
                            backgroundImage = notesObj.backgroundImage;
                        }
                    } catch (e) {
                        // Check if notes contains IMAGE: prefix
                        const imageMatch = game.notes.match(/IMAGE:(.+?)(?:\s|$)/);
                        if (imageMatch) {
                            backgroundImage = imageMatch[1];
                        }
                    }
                }
                
                // If no stored image, construct Steam image URL if we have a steamId
                if (!backgroundImage && steamId) {
                    backgroundImage = `https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/header.jpg`;
                }
                
                return {
                id: game.id,
                gameId: game.gameId,
                    steamId: steamId,
                    steam_id: steamId, // Also include as steam_id for compatibility
                title: game.gameTitle,
                platform: game.platform,
                priority: game.priority,
                notes: game.notes,
                    addedDate: game.createdAt,
                    backgroundImage: backgroundImage,
                    image: backgroundImage, // Also include as image for compatibility
                    background_image: backgroundImage // Also include as background_image for compatibility
                };
            })
        });
    } catch (error) {
        console.error('Error getting library:', error);
        res.status(500).json({ error: 'Failed to get library' });
    }
});

app.post('/api/wishlists/:username/add-game', async (req, res) => {
    try {
        const { username } = req.params;
        const { gameId, gameName, wishlistId, gameData } = req.body;

        if (!gameId || !gameName) {
            return res.status(400).json({ error: 'Game ID and name are required' });
        }

        // Get user from database
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            console.error(`[Add Game] User not found: ${username}`);
            return res.status(404).json({ error: 'User not found' });
        }

        // Extract user ID - try multiple methods
        let userId = null;
        
        // Method 1: Use getDataValue (Sequelize's proper method for accessing field values)
        if (user.getDataValue && typeof user.getDataValue === 'function') {
            try {
                userId = user.getDataValue('user_id');
            } catch (e) {
                console.warn(`[Add Game] getDataValue('user_id') failed:`, e.message);
            }
        }
        
        // Method 2: Check dataValues directly (Sequelize stores field values here)
        if (!userId && user.dataValues && user.dataValues.user_id !== undefined && user.dataValues.user_id !== null) {
            userId = user.dataValues.user_id;
        }
        
        // Method 3: Direct property access (might be set by getter)
        if (!userId && user.user_id !== undefined && user.user_id !== null) {
            userId = user.user_id;
        }
        
        // Method 4: Use toJSON() to convert to plain object
        if (!userId && user.toJSON && typeof user.toJSON === 'function') {
            try {
                const plain = user.toJSON();
                if (plain && plain.user_id !== undefined && plain.user_id !== null) {
                    userId = plain.user_id;
                }
            } catch (e) {
                console.warn(`[Add Game] toJSON() failed:`, e.message);
            }
        }
        
        // Method 5: Fallback - raw query if all else fails
        if (!userId) {
            console.warn(`[Add Game] All extraction methods failed, trying raw query...`);
            try {
                const results = await sequelize.query(
                    `SELECT user_id FROM users WHERE username = :username LIMIT 1`,
                    {
                        replacements: { username },
                        type: QueryTypes.SELECT
                    }
                );
                
                // QueryTypes.SELECT returns an array of objects directly
                if (results && Array.isArray(results) && results.length > 0 && results[0] && results[0].user_id) {
                    userId = results[0].user_id;
                    console.log(`[Add Game] Successfully retrieved user_id via raw query: ${userId}`);
                }
            } catch (rawError) {
                console.error(`[Add Game] Raw query also failed:`, rawError.message, rawError.stack);
            }
        }
        
        if (!userId) {
            // Comprehensive debug logging
            const debugInfo = {
                username: user.username || user.dataValues?.username || 'unknown',
                hasDataValues: !!user.dataValues,
                dataValuesKeys: user.dataValues ? Object.keys(user.dataValues) : [],
                user_id_in_dataValues: user.dataValues?.user_id,
                user_id_direct: user.user_id,
                id_direct: user.id,
                hasGetDataValue: typeof user.getDataValue === 'function',
                hasToJSON: typeof user.toJSON === 'function',
                userInstanceType: user.constructor?.name || typeof user
            };
            
            // Try to get getDataValue result safely
            if (user.getDataValue) {
                try {
                    debugInfo.getDataValueResult = user.getDataValue('user_id');
                } catch (e) {
                    debugInfo.getDataValueError = e.message;
                }
            }
            
            console.error(`[Add Game] User ID extraction failed. User object details:`, debugInfo);
            return res.status(500).json({ error: 'Invalid user data - could not extract user ID. Please check server logs.' });
        }

        console.log(`[Add Game] User found: ${username}, user_id: ${userId}`);

        let targetWishlistId = wishlistId;

        // If no wishlistId provided, get or create default "My Library"
        if (!targetWishlistId) {
            let defaultWishlist = await profileManager.databaseManager.getLibraryByType(userId, 'automatic');

            if (!defaultWishlist) {
                // Create default libraries if they don't exist
                await profileManager.databaseManager.createDefaultLibraries(userId);
                defaultWishlist = await profileManager.databaseManager.getLibraryByType(userId, 'automatic');
            }
            
            if (!defaultWishlist) {
                return res.status(500).json({ error: 'Failed to get or create default library' });
            }
            targetWishlistId = defaultWishlist.id;
        } else {
            // Verify wishlist belongs to user
            const wishlist = await Wishlist.findOne({
                where: { id: targetWishlistId, userId: userId }
            });
            if (!wishlist) {
                return res.status(404).json({ error: 'Library not found' });
            }
        }

        console.log(`[Add Game] Adding game ${gameId} (${gameName}) to library ${targetWishlistId} for user ${userId}`);

        // Check if game already exists in library (by Steam ID only)
        // All games are Steam games, so we only check steamId
        const existingGame = await WishlistGame.findOne({
            where: {
                wishlistId: targetWishlistId,
                steamId: gameId  // gameId is the Steam app ID
            }
        });

        if (existingGame) {
            return res.status(400).json({ 
                success: false,
                error: 'Game is already in this library' 
            });
        }

        // Prepare game data for database - all games are Steam games
        // gameId is the Steam app ID
        const gameDataForDB = {
            gameId: gameId, // Steam app ID (will be stored as steamId)
            steamId: gameId, // Explicitly set steamId to gameId (Steam app ID)
            title: gameName, // Use gameName as title
            name: gameName, // Also include name field
            platform: (gameData && gameData.platform) || 'PC',
            priority: (gameData && gameData.priority) || 'medium',
            notes: (gameData && gameData.notes) || '',
            ...gameData
        };

        console.log(`[Add Game] Prepared game data:`, {
            gameId: gameId,
            steamId: gameId,
            title: gameName,
            platform: gameDataForDB.platform
        });

        // Add game to library using database manager
        try {
            const addedGame = await profileManager.databaseManager.addGameToWishlist(targetWishlistId, gameDataForDB);

            console.log(`[Add Game] Game added successfully:`, addedGame.id);

        res.json({ 
            success: true, 
                message: 'Game added to library',
                game: { 
                    id: addedGame.id,
                    gameId: addedGame.gameId,
                    steamId: addedGame.steamId,
                    title: addedGame.gameTitle,
                    name: addedGame.gameTitle
                }
            });
        } catch (addError) {
            console.error('[Add Game] Error in addGameToWishlist:', addError);
            console.error('[Add Game] Error stack:', addError.stack);
            throw addError; // Re-throw to be caught by outer catch
        }
    } catch (error) {
        console.error('[Add Game] Error adding game to library:', error);
        console.error('[Add Game] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to add game to library';
        if (error.message) {
            errorMessage = `Failed to add game: ${error.message}`;
        }
        
        // Check for specific database errors
        if (error.name === 'SequelizeValidationError') {
            errorMessage = `Validation error: ${error.errors?.map(e => e.message).join(', ') || error.message}`;
        } else if (error.name === 'SequelizeDatabaseError') {
            errorMessage = `Database error: ${error.message}`;
        } else if (error.message && error.message.includes('Steam ID is required')) {
            errorMessage = 'Steam ID is required to add a game';
        }
        
        res.status(500).json({ 
            success: false,
            error: errorMessage 
        });
    }
});

// Remove game from wishlist
app.delete('/api/wishlists/:username/:wishlistId/games/:gameId', async (req, res) => {
    try {
        console.log('[Delete Game] ========== START ==========');
        console.log('[Delete Game] Route hit:', req.method, req.path);
        console.log('[Delete Game] Params:', req.params);
        const { username, wishlistId, gameId } = req.params;

        // Get user from database directly using User model
        const dbUser = await User.findOne({ where: { username } });
        if (!dbUser) {
            console.log('[Delete Game] User not found:', username);
            console.log('[Delete Game] ========== END (USER NOT FOUND) ==========');
            return res.status(404).json({ error: 'User not found' });
        }

        // Extract user ID - try multiple methods
        let userId = dbUser.user_id || 
                     dbUser.getDataValue?.('user_id') || 
                     dbUser.dataValues?.user_id || 
                     dbUser.id ||
                     null;
        
        // If still no userId, try toJSON
        if (!userId && dbUser.toJSON && typeof dbUser.toJSON === 'function') {
            try {
                const plain = dbUser.toJSON();
                userId = plain.user_id || plain.id || null;
            } catch (e) {
                console.error('[Delete Game] Error calling toJSON:', e);
            }
        }
        
        // Last resort: raw SQL query
        if (!userId) {
            try {
                const [results] = await sequelize.query(
                    `SELECT user_id FROM users WHERE username = :username LIMIT 1`,
                    {
                        replacements: { username },
                        type: QueryTypes.SELECT
                    }
                );
                if (results && results.user_id) {
                    userId = results.user_id;
                }
            } catch (sqlError) {
                console.error('[Delete Game] SQL query error:', sqlError);
            }
        }
        
        if (!userId) {
            console.error('[Delete Game] User ID extraction failed for user:', username);
            console.log('[Delete Game] ========== END (NO USER ID) ==========');
            return res.status(500).json({ error: 'Invalid user data - could not extract user ID' });
        }
        
        console.log('[Delete Game] Extracted userId:', userId);
        console.log('[Delete Game] Looking for wishlist:', wishlistId, 'type:', typeof wishlistId, 'for userId:', userId);

        // Parse wishlistId to integer
        const parsedWishlistId = parseInt(wishlistId, 10);
        if (isNaN(parsedWishlistId)) {
            console.log('[Delete Game] Invalid wishlistId:', wishlistId);
            console.log('[Delete Game] ========== END (INVALID WISHLIST ID) ==========');
            return res.status(400).json({ error: 'Invalid library ID' });
        }

        // Verify wishlist belongs to user
        const wishlist = await Wishlist.findOne({
            where: { id: parsedWishlistId, userId: userId }
        });
        if (!wishlist) {
            console.log('[Delete Game] Wishlist not found or doesn\'t belong to user');
            console.log('[Delete Game] ========== END (WISHLIST NOT FOUND) ==========');
            return res.status(404).json({ error: 'Library not found' });
        }
        
        console.log('[Delete Game] Wishlist found:', wishlist.id);

        // Parse gameId - it might be a string from the URL
        const parsedGameId = parseInt(gameId, 10);
        console.log('[Delete Game] Looking for game with gameId:', gameId, 'parsed:', parsedGameId);
        console.log('[Delete Game] WishlistId type:', typeof wishlistId, 'value:', wishlistId);
        console.log('[Delete Game] Parsed wishlistId:', parseInt(wishlistId, 10));

        // Remove game from library (check by gameId or steamId)
        // The steamId field maps to 'steam_id' column in database
        // Try both gameId and steamId, using integer since both are INTEGER types
        let wishlistGame = null;
        
        // First try with steamId (most likely since 447530 looks like a Steam app ID)
        if (!isNaN(parsedGameId)) {
            wishlistGame = await WishlistGame.findOne({
            where: {
                    wishlistId: parsedWishlistId,
                    steamId: parsedGameId
                }
            });
            console.log('[Delete Game] Search by steamId result:', wishlistGame ? 'found' : 'not found');
        }
        
        // If not found by steamId, try gameId
        if (!wishlistGame && !isNaN(parsedGameId)) {
            wishlistGame = await WishlistGame.findOne({
                where: {
                    wishlistId: parsedWishlistId,
                    gameId: parsedGameId
                }
            });
            console.log('[Delete Game] Search by gameId result:', wishlistGame ? 'found' : 'not found');
        }
        
        // If still not found, try with string versions
        if (!wishlistGame) {
            wishlistGame = await WishlistGame.findOne({
                where: {
                    wishlistId: parsedWishlistId,
                [Op.or]: [
                    { gameId: gameId },
                        { steamId: gameId }
                ]
            }
        });
            console.log('[Delete Game] Search by string gameId/steamId result:', wishlistGame ? 'found' : 'not found');
        }
        
        console.log('[Delete Game] Final WishlistGame found:', wishlistGame ? 'yes' : 'no');
        if (wishlistGame) {
            console.log('[Delete Game] WishlistGame details:', {
                id: wishlistGame.id,
                wishlistId: wishlistGame.wishlistId,
                gameId: wishlistGame.gameId,
                steamId: wishlistGame.steamId,
                gameTitle: wishlistGame.gameTitle
            });
        }

        if (wishlistGame) {
            await wishlistGame.destroy();
            console.log('[Delete Game] Game removed successfully');
            console.log('[Delete Game] ========== END (SUCCESS) ==========');
            res.json({ 
                success: true, 
                message: 'Game removed from library' 
            });
        } else {
            console.log('[Delete Game] Game not found in library');
            console.log('[Delete Game] ========== END (NOT FOUND) ==========');
            res.status(404).json({ error: 'Game not found in library' });
        }
    } catch (error) {
        console.error('[Delete Game] Error removing game from library:', error);
        console.error('[Delete Game] Error name:', error.name);
        console.error('[Delete Game] Error message:', error.message);
        console.error('[Delete Game] Error stack:', error.stack);
        
        // Log Sequelize-specific errors
        if (error.name === 'SequelizeDatabaseError') {
            console.error('[Delete Game] Sequelize Database Error:', error.original);
        } else if (error.name === 'SequelizeValidationError') {
            console.error('[Delete Game] Sequelize Validation Error:', error.errors);
        } else if (error.name === 'SequelizeUniqueConstraintError') {
            console.error('[Delete Game] Sequelize Unique Constraint Error:', error.errors);
        }
        
        console.log('[Delete Game] ========== END (ERROR) ==========');
        res.status(500).json({ 
            success: false,
            error: 'Failed to remove game from library',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update library (rename)
app.put('/api/wishlists/:username/:wishlistId', async (req, res) => {
    try {
        const { username, wishlistId } = req.params;
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Library name is required' });
        }

        // Get user from database
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Extract user ID - try multiple methods
        let userId = null;
        
        if (user.getDataValue && typeof user.getDataValue === 'function') {
            try {
                userId = user.getDataValue('user_id');
            } catch (e) {
                // Ignore
            }
        }
        
        if (!userId && user.dataValues && user.dataValues.user_id !== undefined && user.dataValues.user_id !== null) {
            userId = user.dataValues.user_id;
        }
        
        if (!userId && user.user_id !== undefined && user.user_id !== null) {
            userId = user.user_id;
        }
        
        if (!userId && user.toJSON && typeof user.toJSON === 'function') {
            try {
                const plain = user.toJSON();
                if (plain && plain.user_id !== undefined && plain.user_id !== null) {
                    userId = plain.user_id;
                }
            } catch (e) {
                // Ignore
            }
        }
        
        if (!userId) {
            console.error(`[Route] User ID extraction failed for user:`, username);
            return res.status(500).json({ error: 'Invalid user data - could not extract user ID' });
        }

        // Verify library belongs to user
        const wishlist = await Wishlist.findOne({
            where: { id: wishlistId, userId: userId }
        });

        if (!wishlist) {
            return res.status(404).json({ error: 'Library not found' });
        }

        // Don't allow renaming automatic/wishlist type libraries
        if (wishlist.type === 'automatic' || wishlist.type === 'wishlist') {
            return res.status(400).json({ error: 'Cannot rename default libraries' });
        }

        // Update library
        const updated = await profileManager.databaseManager.updateLibrary(wishlistId, {
            name: name,
            description: description || wishlist.description
        });

        if (updated) {
            res.json({ success: true, message: 'Library updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update library' });
        }
    } catch (error) {
        console.error('Error updating library:', error);
        res.status(500).json({ error: 'Failed to update library' });
    }
});

// Delete library
app.delete('/api/wishlists/:username/:wishlistId', async (req, res) => {
    try {
        const { username, wishlistId } = req.params;

        // Get user from database
        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Extract user ID - try multiple methods
        let userId = null;
        
        if (user.getDataValue && typeof user.getDataValue === 'function') {
            try {
                userId = user.getDataValue('user_id');
            } catch (e) {
                // Ignore
            }
        }
        
        if (!userId && user.dataValues && user.dataValues.user_id !== undefined && user.dataValues.user_id !== null) {
            userId = user.dataValues.user_id;
        }
        
        if (!userId && user.user_id !== undefined && user.user_id !== null) {
            userId = user.user_id;
        }
        
        if (!userId && user.toJSON && typeof user.toJSON === 'function') {
            try {
                const plain = user.toJSON();
                if (plain && plain.user_id !== undefined && plain.user_id !== null) {
                    userId = plain.user_id;
                }
            } catch (e) {
                // Ignore
            }
        }
        
        if (!userId) {
            console.error(`[Route] User ID extraction failed for user:`, username);
            return res.status(500).json({ error: 'Invalid user data - could not extract user ID' });
        }

        // Verify library belongs to user
        const wishlist = await Wishlist.findOne({
            where: { id: wishlistId, userId: userId }
        });

        if (!wishlist) {
            return res.status(404).json({ error: 'Library not found' });
        }

        // Don't allow deleting automatic/wishlist type libraries
        if (wishlist.type === 'automatic' || wishlist.type === 'wishlist') {
            return res.status(400).json({ error: 'Cannot delete default libraries' });
        }

        // Delete library
        const deleted = await profileManager.databaseManager.deleteLibrary(wishlistId);

        if (deleted) {
            res.json({ success: true, message: 'Library deleted successfully' });
        } else {
            res.status(500).json({ error: 'Failed to delete library' });
        }
    } catch (error) {
        console.error('Error deleting library:', error);
        res.status(500).json({ error: 'Failed to delete library' });
    }
});

app.get('/api/wishlists/:username/steam-check', async (req, res) => {
    try {
        const { username } = req.params;

        if (!req.session.user || req.session.user.username !== username) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!req.session.user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        profileManager.loadProfile(username);
        const wishlistManager = profileManager.getWishlistManager();

        if (!wishlistManager) {
            return res.status(404).json({ error: 'Wishlist manager not found' });
        }

        const user = await profileManager.getUserByUsername(username);
        if (!user || !user.steam_games) {
            return res.status(400).json({ error: 'Steam games not available' });
        }

        const wishlists = wishlistManager.getWishlists();
        const steamOwnedGames = [];

        wishlists.forEach(wishlist => {
            wishlist.games.forEach(game => {
                if (steamService.userOwnsGame(user, game.id)) {
                    steamOwnedGames.push({
                        gameId: game.id,
                        gameName: game.name,
                        wishlistName: wishlist.name
                    });
                }
            });
        });

        res.json({
            success: true,
            steamOwnedGames,
            totalOwned: steamOwnedGames.length
        });
    } catch (error) {
        console.error('Error checking Steam ownership for wishlist:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reviews routes
app.get('/api/reviews', async (req, res) => {
    try {
        console.log('[Get Reviews] ========== START ==========');
        console.log('[Get Reviews] Session ID:', req.sessionID);
        console.log('[Get Reviews] Has session:', !!req.session);
        console.log('[Get Reviews] Has session.user:', !!req.session?.user);
        
        // Try to restore session if missing
        if (!req.session?.user) {
            console.log('[Get Reviews] No session user, attempting restoration...');
            // Try to get username from query, referer, or cookies
            const referer = req.headers.referer || '';
            const pathMatch = referer.match(/\/profile\/([^\/]+)/);
            let username = pathMatch ? pathMatch[1] : null;
            
            // Also check if there's a username in cookies (if we stored it)
            if (!username && req.cookies && req.cookies.currentUsername) {
                username = req.cookies.currentUsername;
                console.log('[Get Reviews] Found username in cookie:', username);
            }
            
            const restoredUser = await restoreSessionUser(req, username);
            if (!restoredUser) {
                console.log('[Get Reviews] Session restoration failed');
                console.log('[Get Reviews] ========== END (AUTH FAILED) ==========');
            return res.status(401).json({ error: 'Authentication required' });
            }
            console.log('[Get Reviews] Session restored successfully');
        }

        // Extract user ID - try both 'id' and 'user_id' (primary key)
        let userId = req.session.user.id || req.session.user.user_id || null;
        console.log('[Get Reviews] Initial userId from session:', userId);

        // If still no userId, try to get it from the database
        if (!userId && req.session.user.username) {
            console.log('[Get Reviews] No userId in session, querying database for username:', req.session.user.username);
            try {
                const dbUser = await User.findOne({ where: { username: req.session.user.username } });
                if (dbUser) {
                    // Try multiple methods to extract user_id
                    userId = dbUser.user_id || 
                             dbUser.getDataValue?.('user_id') || 
                             dbUser.dataValues?.user_id || 
                             dbUser.id ||
                             null;
                    
                    console.log('[Get Reviews] Found userId from database:', userId);
                    
                    // Update session with the found ID
                    if (userId) {
                        req.session.user.id = userId;
                        req.session.user.user_id = userId;
                        req.session.save();
                        console.log('[Get Reviews] Updated session with userId');
                    }
                } else {
                    console.error('[Get Reviews] User not found in database:', req.session.user.username);
                }
            } catch (dbError) {
                console.error('[Get Reviews] Error querying user:', dbError);
            }
        }

        if (!userId) {
            console.error('[Get Reviews] User ID extraction failed. Session user:', req.session?.user);
            console.log('[Get Reviews] ========== END (NO USER ID) ==========');
            return res.status(401).json({ error: 'User ID not found in session' });
        }
        
        console.log('[Get Reviews] Proceeding with userId:', userId);
        
        // Query reviews - try using userId directly
        let reviews;
        try {
            reviews = await Review.findAll({
            where: { userId: userId },
            order: [['createdAt', 'DESC']]
        });
            console.log('[Get Reviews] Found', reviews.length, 'reviews');
        } catch (queryError) {
            console.error('[Get Reviews] Error querying reviews:', queryError);
            console.error('[Get Reviews] Query error details:', {
                name: queryError.name,
                message: queryError.message,
                stack: queryError.stack
            });
            // Try alternative query using raw SQL if Sequelize query fails
            // Try different column name variations
            try {
                let results = null;
                // Try with "userId" (camelCase)
                try {
                    results = await sequelize.query(
                        'SELECT * FROM reviews WHERE "userId" = :userId ORDER BY "createdAt" DESC',
                        {
                            replacements: { userId: userId },
                            type: QueryTypes.SELECT
                        }
                    );
                } catch (e1) {
                    // Try with "user_id" (snake_case)
                    try {
                        results = await sequelize.query(
                            'SELECT * FROM reviews WHERE user_id = :userId ORDER BY "createdAt" DESC',
                            {
                                replacements: { userId: userId },
                                type: QueryTypes.SELECT
                            }
                        );
                    } catch (e2) {
                        // Try with "userid" (lowercase)
                        try {
                            results = await sequelize.query(
                                'SELECT * FROM reviews WHERE userid = :userId ORDER BY "createdAt" DESC',
                                {
                                    replacements: { userId: userId },
                                    type: QueryTypes.SELECT
                                }
                            );
                        } catch (e3) {
                            throw e1; // Throw first error
                        }
                    }
                }
                
                if (results) {
                    console.log('[Get Reviews] Raw query found', results.length, 'reviews');
                    // Use raw results directly - they're already plain objects
                    reviews = results;
                } else {
                    throw queryError;
                }
            } catch (rawError) {
                console.error('[Get Reviews] Raw query also failed:', rawError);
                throw queryError; // Throw original error
            }
        }

        const reviewIds = reviews.map(review => review.id || review.getDataValue?.('id') || review.dataValues?.id).filter(id => id != null);
        console.log('[Get Reviews] Review IDs:', reviewIds);
        
        let userVotes = [];
        if (reviewIds.length > 0) {
            try {
            userVotes = await ReviewHelpfulVote.findAll({
                where: {
                    reviewId: reviewIds,
                    userId: userId
                }
            });
                console.log('[Get Reviews] Found', userVotes.length, 'user votes');
            } catch (voteError) {
                console.error('[Get Reviews] Error querying votes:', voteError);
                // Continue without votes if query fails
                userVotes = [];
            }
        }

        const votedSet = new Set(userVotes.map(vote => vote.reviewId));

        const serializedReviews = reviews.map(review => {
            // Handle both Sequelize instances and plain objects
            const id = review.id || review.getDataValue?.('id') || review.dataValues?.id;
            const gameTitle = review.gameTitle || review.getDataValue?.('gameTitle') || review.dataValues?.gameTitle;
            // Parse rating as float to handle DECIMAL type from database
            const rawRating = review.rating !== undefined ? review.rating : 
                             (review.getDataValue ? review.getDataValue('rating') : 
                             (review.dataValues ? review.dataValues.rating : null));
            const rating = rawRating !== null && rawRating !== undefined ? parseFloat(rawRating) : 0;
            const reviewText = review.reviewText || review.getDataValue?.('reviewText') || review.dataValues?.reviewText;
            const tags = review.tags || review.getDataValue?.('tags') || review.dataValues?.tags || [];
            const helpfulVotes = review.helpfulVotes || review.getDataValue?.('helpfulVotes') || review.dataValues?.helpfulVotes || 0;
            const isPublic = review.isPublic !== undefined ? review.isPublic : (review.getDataValue?.('isPublic') !== undefined ? review.getDataValue('isPublic') : review.dataValues?.isPublic);
            const isApproved = review.isApproved !== undefined ? review.isApproved : (review.getDataValue?.('isApproved') !== undefined ? review.getDataValue('isApproved') : review.dataValues?.isApproved);
            
            // Extract rejectionReason with multiple fallbacks
            let rejectionReason = null;
            if (review.rejectionReason !== undefined && review.rejectionReason !== null) {
                rejectionReason = review.rejectionReason;
            } else if (review.getDataValue && review.getDataValue('rejectionReason') !== undefined && review.getDataValue('rejectionReason') !== null) {
                rejectionReason = review.getDataValue('rejectionReason');
            } else if (review.dataValues && review.dataValues.rejectionReason !== undefined && review.dataValues.rejectionReason !== null) {
                rejectionReason = review.dataValues.rejectionReason;
            } else if (review.toJSON && typeof review.toJSON === 'function') {
                const jsonData = review.toJSON();
                if (jsonData.rejectionReason !== undefined && jsonData.rejectionReason !== null) {
                    rejectionReason = jsonData.rejectionReason;
                }
            }
            
            // Log rejection reason for debugging
            if (rejectionReason) {
                console.log('[Get Reviews] Found rejection reason for review', id, ':', rejectionReason);
            }
            
            const createdAt = review.createdAt || review.getDataValue?.('createdAt') || review.dataValues?.createdAt;
            const updatedAt = review.updatedAt || review.getDataValue?.('updatedAt') || review.dataValues?.updatedAt;
            
            return {
                id: id,
                gameTitle: gameTitle,
                rating: rating,
                reviewText: reviewText,
                tags: Array.isArray(tags) ? tags : [],
                helpfulVotes: helpfulVotes,
                isPublic: isPublic !== undefined ? isPublic : true,
                isApproved: isApproved !== undefined ? isApproved : false,
                rejectionReason: rejectionReason,
                createdAt: createdAt,
                updatedAt: updatedAt,
                userHasVoted: votedSet.has(id)
            };
        });

        // Calculate average rating - ensure all ratings are numbers
        const ratingsWithValues = serializedReviews
            .map(r => parseFloat(r.rating) || 0)
            .filter(r => r > 0);
        
        const averageRating = ratingsWithValues.length > 0
            ? ratingsWithValues.reduce((sum, rating) => sum + rating, 0) / ratingsWithValues.length
            : 0;
        
        const finalAverageRating = !isNaN(averageRating) && isFinite(averageRating) ? parseFloat(averageRating.toFixed(1)) : 0;
        
        console.log('[Get Reviews] Average rating calculation:', {
            totalReviews: serializedReviews.length,
            ratings: serializedReviews.map(r => ({ id: r.id, rating: r.rating, parsed: parseFloat(r.rating) })),
            averageRating: finalAverageRating
        });

        res.json({
            success: true,
            reviews: serializedReviews,
            averageRating: finalAverageRating,
            totalReviews: serializedReviews.length
        });
    } catch (error) {
        console.error('[Get Reviews] Error fetching reviews:', error);
        console.error('[Get Reviews] Error stack:', error.stack);
        console.log('[Get Reviews] ========== END (ERROR) ==========');
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch reviews',
            message: error.message || 'An error occurred while fetching reviews'
        });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        console.log('[Create Review] ========== START ==========');
        console.log('[Create Review] Session ID:', req.sessionID);
        console.log('[Create Review] Has session.user:', !!req.session?.user);
        
        // Try to restore session if missing
        if (!req.session?.user) {
            console.log('[Create Review] No session user, attempting restoration...');
            // Try to get username from cookies
            let username = null;
            if (req.cookies && req.cookies.currentUsername) {
                username = req.cookies.currentUsername;
                console.log('[Create Review] Found username in cookie:', username);
            }
            
            const restoredUser = await restoreSessionUser(req, username);
            if (!restoredUser) {
                console.log('[Create Review] Session restoration failed');
                console.log('[Create Review] ========== END (AUTH FAILED) ==========');
            return res.status(401).json({ error: 'Authentication required' });
            }
            console.log('[Create Review] Session restored successfully');
        }

        // Extract user ID - try both 'id' and 'user_id' (primary key)
        let userId = req.session.user.id || req.session.user.user_id || null;
        console.log('[Create Review] Initial userId from session:', userId);

        // If still no userId, try to get it from the database
        if (!userId && req.session.user.username) {
            console.log('[Create Review] No userId in session, querying database for username:', req.session.user.username);
            try {
                const dbUser = await User.findOne({ where: { username: req.session.user.username } });
                if (dbUser) {
                    // Try multiple methods to extract user_id
                    userId = dbUser.user_id || 
                             dbUser.getDataValue?.('user_id') || 
                             dbUser.dataValues?.user_id || 
                             dbUser.id ||
                             null;
                    
                    console.log('[Create Review] Found userId from database:', userId);
                    
                    // Update session with the found ID
                    if (userId) {
                        req.session.user.id = userId;
                        req.session.user.user_id = userId;
                        req.session.save();
                        console.log('[Create Review] Updated session with userId');
                    }
                } else {
                    console.error('[Create Review] User not found in database:', req.session.user.username);
                }
            } catch (dbError) {
                console.error('[Create Review] Error querying user:', dbError);
            }
        }

        if (!userId) {
            console.error('[Create Review] User ID extraction failed. Session user:', req.session?.user);
            console.log('[Create Review] ========== END (NO USER ID) ==========');
            return res.status(401).json({ error: 'User ID not found in session' });
        }

        const { gameTitle, rating, reviewText, tags, isPublic } = req.body;
        console.log('[Create Review] Proceeding with userId:', userId);

        const safeTitle = typeof gameTitle === 'string' ? gameTitle.trim() : '';
        const parsedRating = parseFloat(rating);
        const safeReviewText = typeof reviewText === 'string' ? reviewText.trim() : '';
        const normalizedTags = normalizeReviewTags(tags);
        const userWantsPublic = !(isPublic === false || isPublic === 'false');
        
        // If user wants review to be public, it needs admin approval first
        // So set isPublic to false and isApproved to false until admin approves
        // Store the user's original intent in intendedPublic
        const finalIsPublic = false; // Always false until approved (even if user wants public)
        const isApproved = userWantsPublic ? false : true; // Requires admin approval only if user wants public
        const intendedPublic = userWantsPublic; // Store user's original intent

        if (!safeTitle || Number.isNaN(parsedRating) || !safeReviewText) {
            return res.status(400).json({ 
                success: false,
                error: 'Game title, rating, and review text are required' 
            });
        }

        // Round to nearest 0.5 for validation
        const roundedRating = Math.round(parsedRating * 2) / 2;
        if (roundedRating < 0.5 || roundedRating > 5.0) {
            return res.status(400).json({ 
                success: false,
                error: 'Rating must be between 0.5 and 5.0' 
            });
        }

        if (safeReviewText.length < 10 || safeReviewText.length > 5000) {
            return res.status(400).json({ 
                success: false,
                error: 'Review text must be between 10 and 5000 characters' 
            });
        }

        console.log('[Create Review] Creating review with data:', {
            userId: userId,
            gameTitle: safeTitle,
            rating: roundedRating,
            reviewTextLength: safeReviewText.length,
            tags: normalizedTags,
            isPublic: finalIsPublic,
            isApproved: isApproved,
            intendedPublic: intendedPublic
        });

        let review;
        try {
            // Create review with explicit field mapping
            review = await Review.create({
                userId: userId,
                gameTitle: safeTitle,
                rating: roundedRating,
                reviewText: safeReviewText,
                tags: normalizedTags.length > 0 ? normalizedTags : [],
                isPublic: finalIsPublic,
                isApproved: isApproved,
                intendedPublic: intendedPublic,
            helpfulVotes: 0
        });
        } catch (createError) {
            console.error('[Create Review] Review.create() failed:', createError);
            console.error('[Create Review] Error name:', createError.name);
            console.error('[Create Review] Error message:', createError.message);
            console.error('[Create Review] Error details:', createError.errors || createError);
            console.error('[Create Review] Full error:', JSON.stringify(createError, null, 2));
            
            // Provide more specific error messages
            if (createError.name === 'SequelizeValidationError') {
                const validationErrors = createError.errors?.map(e => `${e.path}: ${e.message}`).join(', ') || createError.message;
                return res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    message: `Review validation failed: ${validationErrors}`
                });
            } else if (createError.name === 'SequelizeForeignKeyConstraintError') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid user',
                    message: 'User not found. Please log in again.'
                });
            } else if (createError.name === 'SequelizeDatabaseError') {
                // Database error - might be missing columns
                return res.status(500).json({
                    success: false,
                    error: 'Database error',
                    message: 'Database error occurred. Please check if migrations have been run.'
                });
            } else {
                // Re-throw to be caught by outer catch
                throw createError;
            }
        }

        console.log('[Create Review] Review created successfully with ID:', review.id);
        console.log('[Create Review] ========== END (SUCCESS) ==========');

        const message = intendedPublic 
            ? 'Review submitted successfully! Your review is pending admin approval before it can be made public.'
            : 'Review submitted successfully!';

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
                isApproved: review.isApproved,
                intendedPublic: review.intendedPublic,
                createdAt: review.createdAt
            },
            message: message
        });
    } catch (error) {
        console.error('[Create Review] Error creating review:', error);
        console.error('[Create Review] Error stack:', error.stack);
        console.error('[Create Review] Error details:', {
            name: error.name,
            message: error.message,
            userId: req.session?.user?.id || req.session?.user?.user_id,
            errors: error.errors || null
        });
        console.log('[Create Review] ========== END (ERROR) ==========');
        
        // Provide more specific error messages
        let errorMessage = 'Failed to create review';
        if (error.name === 'SequelizeValidationError') {
            const validationErrors = error.errors?.map(e => e.message).join(', ') || error.message;
            errorMessage = `Validation error: ${validationErrors}`;
        } else if (error.name === 'SequelizeForeignKeyConstraintError') {
            errorMessage = 'Invalid user or game. Please log in again.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            success: false,
            error: errorMessage,
            message: errorMessage
        });
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

        const safeTitle = typeof gameTitle === 'string' ? gameTitle.trim() : '';
        const parsedRating = parseFloat(rating);
        const safeReviewText = typeof reviewText === 'string' ? reviewText.trim() : '';
        const normalizedTags = normalizeReviewTags(tags);
        const visibility = !(isPublic === false || isPublic === 'false');
        
        // Round to nearest 0.5 for validation
        const roundedRating = Math.round(parsedRating * 2) / 2;

        const review = await Review.findOne({
            where: { id: reviewId, userId: userId }
        });

        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        if (!safeTitle || Number.isNaN(parsedRating) || !safeReviewText) {
            return res.status(400).json({ error: 'Game title, rating, and review text are required' });
        }

        if (roundedRating < 0.5 || roundedRating > 5.0) {
            return res.status(400).json({ error: 'Rating must be between 0.5 and 5.0' });
        }

        if (safeReviewText.length < 10 || safeReviewText.length > 5000) {
            return res.status(400).json({ error: 'Review text must be between 10 and 5000 characters' });
        }

        review.gameTitle = safeTitle;
        review.rating = roundedRating;
        review.reviewText = safeReviewText;
        review.tags = normalizedTags;
        review.isPublic = visibility;

        await review.save();

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
        console.log('[Delete Review] ========== START ==========');
        console.log('[Delete Review] Session ID:', req.sessionID);
        console.log('[Delete Review] Has session:', !!req.session);
        console.log('[Delete Review] Has session.user:', !!req.session?.user);
        
        // Try to restore session if missing
        if (!req.session?.user) {
            console.log('[Delete Review] No session user, attempting restoration...');
            const referer = req.headers.referer || '';
            const pathMatch = referer.match(/\/profile\/([^\/]+)/);
            let username = pathMatch ? pathMatch[1] : null;
            
            if (!username && req.cookies && req.cookies.currentUsername) {
                username = req.cookies.currentUsername;
                console.log('[Delete Review] Found username in cookie:', username);
            }
            
            const restoredUser = await restoreSessionUser(req, username);
            if (!restoredUser) {
                console.log('[Delete Review] Session restoration failed');
                console.log('[Delete Review] ========== END (AUTH FAILED) ==========');
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }
            console.log('[Delete Review] Session restored successfully');
        }

        const { reviewId } = req.params;
        const reviewIdInt = parseInt(reviewId, 10);
        
        if (Number.isNaN(reviewIdInt)) {
            return res.status(400).json({ success: false, error: 'Invalid review ID' });
        }
        
        // Extract user ID - try both 'id' and 'user_id'
        let userId = req.session.user.id || req.session.user.user_id || null;
        console.log('[Delete Review] Initial userId from session:', userId);

        // If still no userId, try to get it from the database
        if (!userId && req.session.user.username) {
            console.log('[Delete Review] No userId in session, querying database for username:', req.session.user.username);
            try {
                const dbUser = await User.findOne({ where: { username: req.session.user.username } });
                if (dbUser) {
                    userId = dbUser.user_id || 
                             dbUser.getDataValue?.('user_id') || 
                             dbUser.dataValues?.user_id || 
                             dbUser.id ||
                             null;
                    
                    console.log('[Delete Review] Found userId from database:', userId);
                    
                    // Update session with the found ID
                    if (userId) {
                        req.session.user.id = userId;
                        req.session.user.user_id = userId;
                        req.session.save();
                        console.log('[Delete Review] Updated session with userId');
                    }
                }
            } catch (dbError) {
                console.error('[Delete Review] Error querying user:', dbError);
            }
        }

        if (!userId) {
            console.error('[Delete Review] User ID extraction failed');
            console.log('[Delete Review] ========== END (NO USER ID) ==========');
            return res.status(401).json({ success: false, error: 'User ID not found in session' });
        }
        
        console.log('[Delete Review] Proceeding with userId:', userId, 'reviewId:', reviewIdInt);

        const review = await Review.findOne({
            where: { 
                id: reviewIdInt, 
                userId: userId 
            }
        });

        if (!review) {
            console.log('[Delete Review] Review not found or not owned by user');
            console.log('[Delete Review] ========== END (NOT FOUND) ==========');
            return res.status(404).json({ success: false, error: 'Review not found or you do not have permission to delete it' });
        }

        await review.destroy();
        
        console.log('[Delete Review] Review deleted successfully');
        console.log('[Delete Review] ========== END (SUCCESS) ==========');

        res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
        console.error('[Delete Review] Error deleting review:', error);
        console.log('[Delete Review] ========== END (ERROR) ==========');
        res.status(500).json({ success: false, error: 'Failed to delete review' });
    }
});

app.get('/api/admin/check', async (req, res) => {
    try {
        console.log('[Admin Check] Request received');
        
        if (!req.session.user) {
            console.log('[Admin Check] No session user');
            return res.json({ success: false, isAdmin: false });
        }

        console.log('[Admin Check] Session user:', req.session.user.username);

        // Use DatabaseManager to avoid connection issues
        const user = await profileManager.databaseManager.getUserByUsername(req.session.user.username);

        console.log('[Admin Check] User found:', user ? user.username : 'none');
        console.log('[Admin Check] Is admin:', user ? user.is_admin : false);

        if (user && user.is_admin) {
            req.session.isAdmin = true;
            console.log('[Admin Check] Returning isAdmin: true');
            res.json({ success: true, isAdmin: true });
        } else {
            console.log('[Admin Check] Returning isAdmin: false');
            res.json({ success: false, isAdmin: false });
        }
    } catch (error) {
        console.error('[Admin Check] Error checking admin status:', error);
        res.json({ success: false, isAdmin: false });
    }
});

// Admin login - Uses AdminManager with database
app.post('/api/admin/login', async (req, res) => {
    try {
        console.log('[Admin Login] ===== REQUEST RECEIVED =====');
        console.log('[Admin Login] Request body:', JSON.stringify(req.body));
        console.log('[Admin Login] Request headers:', JSON.stringify(req.headers));
        
        const { username, password } = req.body;

        if (!username || !password) {
            console.log('[Admin Login] Missing username or password');
            return res.status(400).json({ error: 'Username and password are required' });
        }

        console.log(`[Admin Login] Attempting login for username: ${username}`);
        console.log(`[Admin Login] Password length: ${password ? password.length : 0}`);

        // Use DatabaseManager instead of User model directly to avoid connection issues
        const bcrypt = require('bcrypt');
        
        console.log('[Admin Login] Querying database using DatabaseManager...');
        const user = await profileManager.databaseManager.getUserByUsername(username);

        if (!user) {
            console.log(`[Admin Login] ❌ User not found: ${username}`);
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        // Check if user is admin and active
        if (!user.is_admin || !user.is_active) {
            console.log(`[Admin Login] ❌ User is not admin or not active: ${username}`);
            console.log(`[Admin Login] is_admin: ${user.is_admin}, is_active: ${user.is_active}`);
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        console.log(`[Admin Login] ✅ Admin user found: ${user.username}`);
        console.log(`[Admin Login] Password hash: ${user.password_hash ? user.password_hash.substring(0, 30) + '...' : 'NOT SET'}`);
        console.log(`[Admin Login] Verifying password...`);

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            console.log(`[Admin Login] ❌ Password mismatch for user: ${username}`);
            console.log(`[Admin Login] Input password: "${password}"`);
            console.log(`[Admin Login] Hash comparison failed`);
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        console.log(`[Admin Login] ✅ Password verified successfully for: ${username}`);

        // Set admin session with user ID
        const userId = user.user_id || user.getDataValue?.('user_id') || user.dataValues?.user_id;
        req.session.user = {
            id: userId,
            user_id: userId,
            username: user.username,
            email: user.email,
            joinDate: user.join_date,
            isAdmin: true
        };
        req.session.isAdmin = true;

        // Log admin login
        adminManager.logAction('admin_login', `Admin ${username} logged in`);

        // Force session save
        req.session.save((err) => {
            if (err) {
                console.error('[Admin Login] ❌ Session save error:', err);
                return res.status(500).json({ error: 'Session save failed' });
            }

            console.log(`[Admin Login] ✅ Login successful for: ${username}`);
            console.log(`[Admin Login] Session ID: ${req.sessionID}`);
        res.json({ 
            success: true, 
            admin: { 
                username: user.username, 
                permissions: ['user_management', 'system_logs'] 
            } 
            });
        });
    } catch (error) {
        console.error('[Admin Login] ❌ Error during admin login:', error);
        console.error('[Admin Login] Error name:', error.name);
        console.error('[Admin Login] Error message:', error.message);
        console.error('[Admin Login] Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Admin authentication middleware
async function requireAdmin(req, res, next) {
    try {
        // Try to restore session if needed
        if (!req.session?.user) {
            await restoreSessionUser(req);
        }

        if (!req.session?.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        let userId = req.session.user.id || req.session.user.user_id;
        
        // If still no userId, try to get it from username
        if (!userId && req.session.user.username) {
            const userByUsername = await User.findOne({ 
                where: { username: req.session.user.username } 
            });
            if (userByUsername) {
                userId = userByUsername.user_id || userByUsername.getDataValue?.('user_id') || userByUsername.dataValues?.user_id;
                // Update session with user ID
                req.session.user.id = userId;
                req.session.user.user_id = userId;
                await req.session.save();
            }
        }

        if (!userId) {
            return res.status(401).json({ success: false, error: 'User ID not found' });
        }

        const user = await User.findByPk(userId);
        if (!user || !user.is_admin) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        // Attach user to request for use in route handlers
        req.adminUser = user;
        req.adminUserId = userId;
        next();
    } catch (error) {
        console.error('Error in requireAdmin middleware:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    req.session.save((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.json({ success: true });
    });
});

// Admin Stats Endpoint
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {

        // Get user statistics
        const totalUsers = await User.count();
        const activeUsers = await User.count({ where: { is_active: true } });
        const totalAdmins = await User.count({ where: { is_admin: true } });
        
        // Get new users this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const newUsersThisMonth = await User.count({
            where: {
                join_date: {
                    [Op.gte]: startOfMonth
                }
            }
        });

        res.json({
            success: true,
            isAdmin: true,
            userStats: {
                totalUsers,
                activeUsers,
                newUsersThisMonth,
                totalAdmins
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

// Admin Users List Endpoint
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {

        // Get all users
        const users = await User.findAll({
            attributes: ['user_id', 'username', 'email', 'join_date', 'is_active', 'is_admin'],
            order: [['join_date', 'DESC']]
        });

        res.json({
            success: true,
            users: users.map(u => ({
                id: u.user_id || u.getDataValue?.('user_id') || u.dataValues?.user_id,
                username: u.username || u.getDataValue?.('username') || u.dataValues?.username,
                email: u.email || u.getDataValue?.('email') || u.dataValues?.email,
                joinDate: u.join_date || u.getDataValue?.('join_date') || u.dataValues?.join_date,
                isActive: u.is_active || u.getDataValue?.('is_active') || u.dataValues?.is_active,
                isAdmin: u.is_admin || u.getDataValue?.('is_admin') || u.dataValues?.is_admin
            }))
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// Admin List Endpoint
app.get('/api/admin/list', requireAdmin, async (req, res) => {
    try {

        // Get all admins
        const admins = await User.findAll({
            where: { is_admin: true },
            attributes: ['user_id', 'username', 'email', 'join_date'],
            order: [['join_date', 'DESC']]
        });

        res.json({
            success: true,
            admins: admins.map(a => ({
                id: a.user_id || a.getDataValue?.('user_id') || a.dataValues?.user_id,
                username: a.username || a.getDataValue?.('username') || a.dataValues?.username,
                email: a.email || a.getDataValue?.('email') || a.dataValues?.email,
                joinDate: a.join_date || a.getDataValue?.('join_date') || a.dataValues?.join_date
            }))
        });
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch admins' });
    }
});

// Admin Create Endpoint
app.post('/api/admin/create', requireAdmin, async (req, res) => {
    try {

        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        // Use DatabaseManager to create admin
        const admin = await profileManager.databaseManager.createAdmin(username, email, password);

        res.json({
            success: true,
            message: `Admin ${username} created successfully`,
            admin: {
                id: admin.user_id,
                username: admin.username,
                email: admin.email
            }
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create admin' });
    }
});

// Admin Logs Endpoint
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
    try {

        // For now, return a simple log structure
        // In a real application, you'd have a logs table
        const logs = [
            {
                action: 'Admin Login',
                details: `Admin ${user.username} logged in`,
                timestamp: new Date()
            },
            {
                action: 'System Start',
                details: 'Server started successfully',
                timestamp: new Date(Date.now() - 3600000) // 1 hour ago
            }
        ];

        res.json({
            success: true,
            logs: logs
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch logs' });
    }
});

// Admin User Status Toggle
app.put('/api/admin/users/:userId/status', requireAdmin, async (req, res) => {
    try {

        const targetUserId = parseInt(req.params.userId, 10);
        const { isActive } = req.body;

        const targetUser = await User.findByPk(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        await targetUser.update({ is_active: isActive });

        res.json({
            success: true,
            message: `User ${targetUser.username} ${isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ success: false, error: 'Failed to update user status' });
    }
});

// Admin Promote User
app.post('/api/admin/users/:username/promote', requireAdmin, async (req, res) => {
    try {

        const { username } = req.params;
        await profileManager.databaseManager.promoteToAdmin(username);

        res.json({
            success: true,
            message: `User ${username} promoted to admin successfully`
        });
    } catch (error) {
        console.error('Error promoting user:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to promote user' });
    }
});

// Admin Demote User
app.post('/api/admin/users/:username/demote', requireAdmin, async (req, res) => {
    try {

        const { username } = req.params;
        await profileManager.databaseManager.demoteFromAdmin(username);

        res.json({
            success: true,
            message: `User ${username} demoted from admin successfully`
        });
    } catch (error) {
        console.error('Error demoting user:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to demote user' });
    }
});

// Admin Delete User
app.delete('/api/admin/users/:userId', requireAdmin, async (req, res) => {
    try {

        const targetUserId = parseInt(req.params.userId, 10);
        
        // Don't allow deleting yourself
        if (targetUserId === req.adminUserId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const targetUser = await User.findByPk(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        await targetUser.destroy();

        res.json({
            success: true,
            message: `User ${targetUser.username} deleted successfully`
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

app.get('/api/games/search', async (req, res) => {
    console.log('🚀 [API] /api/games/search endpoint HIT!');
    console.log('🚀 [API] Query params:', req.query);
    
    const { q: query, page = 1, pageSize = 20 } = req.query;

    if (!query || query.trim().length === 0) {
        console.log('🚀 [API] No query provided, returning 400');
        return res.status(400).json({ 
            success: false, 
            error: 'Search query is required' 
        });
    }

    try {
        console.log(`\n🔍 [Search API] ==========================================`);
        console.log(`[Search API] Query: "${query}", Page: ${page}, PageSize: ${pageSize}`);
        console.log(`[Search API] Starting search...`);
        
        const result = await gameSearchService.searchGames(query.trim(), parseInt(page), parseInt(pageSize));

        console.log(`[Search API] Search completed. Result:`, {
            success: result?.success,
            gamesCount: result?.games?.length || 0,
            totalResults: result?.totalResults || 0,
            isMockData: result?.isMockData || false,
            hasError: !!result?.error
        });

        // Ensure result has the correct structure
        if (!result || typeof result !== 'object') {
            console.error('[Search API] ❌ Invalid result format:', result);
            return res.status(500).json({
                success: false,
                error: 'Invalid search result format',
                games: [],
                totalResults: 0,
                currentPage: parseInt(page) || 1,
                totalPages: 0,
                isMockData: false
            });
        }

        // Ensure games array exists
        if (!result.games || !Array.isArray(result.games)) {
            console.error('[Search API] ❌ Missing or invalid games array:', result);
            result.games = [];
        }
        
        // Log if there's an error
        if (result.success === false || result.error) {
            console.error(`[Search API] ❌ Search failed: ${result.error || 'Unknown error'}`);
        } else {
            console.log(`[Search API] ✅ Search successful: ${result.games.length} games returned`);
        }
        
        console.log(`[Search API] ==========================================\n`);

        // Ensure required fields exist
        if (typeof result.success === 'undefined') {
            result.success = true;
        }
        if (typeof result.totalResults === 'undefined') {
            result.totalResults = result.games ? result.games.length : 0;
        }
        if (typeof result.currentPage === 'undefined') {
            result.currentPage = parseInt(page) || 1;
        }
        if (typeof result.totalPages === 'undefined') {
            result.totalPages = result.totalResults > 0 ? Math.ceil(result.totalResults / parseInt(pageSize)) : 0;
        }

        if (req.session.user && req.session.user.steam_id) {
            const user = await profileManager.getUserByUsername(req.session.user.username);
            if (user && user.steam_games) {
                result.games = steamService.getSteamOwnershipStatus(user, result.games);
            }
        }
        
        console.log(`[Search API] Returning ${result.games.length} games, totalResults: ${result.totalResults}, totalPages: ${result.totalPages}`);
        res.json(result);
    } catch (error) {
        console.error('Error in game search:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            error: 'Failed to search games',
            games: [],
            totalResults: 0,
            isMockData: true
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

// Diagnostic endpoint to check Steam app list status
app.get('/api/games/debug/applist', async (req, res) => {
    try {
        const appList = await gameSearchService.getSteamAppList();
        const hasCache = !!gameSearchService.appListCache;
        const cacheTime = gameSearchService.appListCacheTime;
        const cacheAge = cacheTime ? Date.now() - cacheTime : null;
        
        res.json({
            success: true,
            appListLoaded: appList && appList.length > 0,
            appListCount: appList ? appList.length : 0,
            hasCache: hasCache,
            cacheAge: cacheAge ? Math.floor(cacheAge / 1000) + ' seconds' : null,
            isBlocked: gameSearchService.steamApiBlocked,
            sampleGames: appList && appList.length > 0 ? appList.slice(0, 10).map(g => ({ appid: g.appid, name: g.name })) : []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Trending games endpoint
app.get('/api/games/trending', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        const result = await gameSearchService.getTrendingGames(limit);
        res.json(result);
    } catch (error) {
        console.error('Error getting trending games:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch trending games',
            games: []
        });
    }
});

// Recent games endpoint
app.get('/api/games/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        const result = await gameSearchService.getRecentGames(limit);
        res.json(result);
    } catch (error) {
        console.error('Error getting recent games:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch recent games',
            games: []
        });
    }
});

app.get('/api/games/:gameId', async (req, res) => {
    const { gameId } = req.params;

    if (!gameId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Game ID is required',
            game: null
        });
    }

    try {
        console.log(`[Game Details API] Request for game ID: ${gameId}`);
        const result = await gameSearchService.getGameDetails(gameId);
        console.log(`[Game Details API] Result: success=${result.success}, game=${result.game ? result.game.name : 'null'}`);
        res.json(result);
    } catch (error) {
        console.error('[Game Details API] Error:', error);
        console.error('[Game Details API] Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            error: `Failed to fetch game details: ${error.message}`,
            game: null
        });
    }
});

app.get('/api/steam/profile', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        if (!req.session.user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        const result = await steamService.getUserProfile(req.session.user.steam_id);
        res.json(result);
    } catch (error) {
        console.error('Error fetching Steam profile:', error);
        res.status(500).json({ error: 'Failed to fetch Steam profile' });
    }
});

app.get('/api/steam/games', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        if (!req.session.user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        const user = await profileManager.getUserByUsername(req.session.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.steam_games && user.steam_last_sync) {
            const hoursSinceSync = (new Date() - new Date(user.steam_last_sync)) / (1000 * 60 * 60);
            if (hoursSinceSync < 24) {
                return res.json({
                    success: true,
                    games: user.steam_games,
                    game_count: user.steam_games.length,
                    cached: true,
                    last_sync: user.steam_last_sync
                });
            }
        }

        const result = await steamService.getUserGameLibrary(req.session.user.steam_id);
        if (result.success) {

            user.steam_games = result.games;
            user.steam_last_sync = new Date();
            await user.save();
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching Steam games:', error);
        res.status(500).json({ error: 'Failed to fetch Steam games' });
    }
});

app.post('/api/steam/sync', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        if (!req.session.user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        const user = await profileManager.getUserByUsername(req.session.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await steamService.syncUserGames(user);
        res.json(result);
    } catch (error) {
        console.error('Error syncing Steam games:', error);
        res.status(500).json({ error: 'Failed to sync Steam games' });
    }
});

app.get('/api/steam/games/:appId/achievements', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        if (!req.session.user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        const { appId } = req.params;
        const result = await steamService.getUserAchievements(req.session.user.steam_id, appId);
        res.json(result);
    } catch (error) {
        console.error('Error fetching Steam achievements:', error);
        res.status(500).json({ error: 'Failed to fetch Steam achievements' });
    }
});

app.get('/api/steam/game/:appId', async (req, res) => {
    try {
        const { appId } = req.params;
        const result = await steamService.getGameDetails(appId);
        res.json(result);
    } catch (error) {
        console.error('Error fetching Steam game details:', error);
        res.status(500).json({ error: 'Failed to fetch Steam game details' });
    }
});

// Settings API
app.get('/api/settings', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        const user = await User.findOne({ where: { username: req.session.user.username } });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return user settings (stored in gaming_preferences.settings)
        const gamingPreferences = user.gaming_preferences || user.getDataValue?.('gaming_preferences') || user.dataValues?.gaming_preferences || {};
        const settings = gamingPreferences.settings || {};
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        const user = await User.findOne({ where: { username: req.session.user.username } });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Save settings in gaming_preferences.settings
        const currentPreferences = user.gaming_preferences || user.getDataValue?.('gaming_preferences') || user.dataValues?.gaming_preferences || {};
        // Ensure we have a proper object (not a Sequelize instance)
        const preferencesObj = typeof currentPreferences === 'object' && currentPreferences !== null && !currentPreferences.getDataValue ? currentPreferences : {};
        preferencesObj.settings = req.body;
        
        // Use setDataValue for Sequelize instances
        if (user.setDataValue) {
            user.setDataValue('gaming_preferences', preferencesObj);
        } else {
            user.gaming_preferences = preferencesObj;
        }
        await user.save();

        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// ===== Admin Endpoints (must be before 404 handler) =====
// Admin endpoints for review moderation
app.get('/api/admin/reviews/pending', requireAdmin, async (req, res) => {
    try {
        console.log('[Admin Pending Reviews] Endpoint called');
        console.log('[Admin Pending Reviews] Session user:', req.session?.user?.username);
        console.log('[Admin Pending Reviews] Admin user ID:', req.adminUserId);

        // Get all pending reviews (intended to be public but not yet approved and not rejected)
        const pendingReviews = await Review.findAll({
            where: {
                intendedPublic: true,
                isApproved: false,
                rejectionReason: null  // Exclude rejected reviews
            },
            include: [{ 
                model: User, 
                as: 'user', 
                attributes: ['user_id', 'username', 'email'] 
            }],
            order: [['createdAt', 'DESC']]
        });

        console.log('[Admin Pending Reviews] Found', pendingReviews.length, 'pending reviews');

        res.json({
            success: true,
            reviews: pendingReviews.map(review => {
                // Extract review data safely
                const reviewData = {
                    id: review.id || review.getDataValue?.('id') || review.dataValues?.id,
                    gameTitle: review.gameTitle || review.getDataValue?.('gameTitle') || review.dataValues?.gameTitle,
                    rating: review.rating || review.getDataValue?.('rating') || review.dataValues?.rating,
                    reviewText: review.reviewText || review.getDataValue?.('reviewText') || review.dataValues?.reviewText,
                    tags: Array.isArray(review.tags) ? review.tags : (review.tags ? (typeof review.tags === 'string' ? review.tags.split(',') : []) : []),
                    helpfulVotes: review.helpfulVotes || review.getDataValue?.('helpfulVotes') || review.dataValues?.helpfulVotes || 0,
                    isPublic: review.isPublic !== undefined ? review.isPublic : (review.getDataValue?.('isPublic') !== undefined ? review.getDataValue('isPublic') : review.dataValues?.isPublic),
                    isApproved: review.isApproved !== undefined ? review.isApproved : (review.getDataValue?.('isApproved') !== undefined ? review.getDataValue('isApproved') : review.dataValues?.isApproved),
                    intendedPublic: review.intendedPublic !== undefined ? review.intendedPublic : (review.getDataValue?.('intendedPublic') !== undefined ? review.getDataValue('intendedPublic') : review.dataValues?.intendedPublic),
                    createdAt: review.createdAt || review.getDataValue?.('createdAt') || review.dataValues?.createdAt,
                    updatedAt: review.updatedAt || review.getDataValue?.('updatedAt') || review.dataValues?.updatedAt,
                    user: null
                };

                // Extract user data if included
                if (review.user) {
                    reviewData.user = {
                        id: review.user.user_id || review.user.getDataValue?.('user_id') || review.user.dataValues?.user_id,
                        username: review.user.username || review.user.getDataValue?.('username') || review.user.dataValues?.username,
                        email: review.user.email || review.user.getDataValue?.('email') || review.user.dataValues?.email
                    };
                }

                return reviewData;
            })
        });
            } catch (error) {
        console.error('Error fetching pending reviews:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch pending reviews',
            message: error.message || 'An error occurred while fetching pending reviews'
        });
    }
});

app.post('/api/admin/reviews/:reviewId/approve', requireAdmin, async (req, res) => {
    try {
        console.log('[Approve Review] Endpoint called');
        console.log('[Approve Review] Review ID:', req.params.reviewId);
        console.log('[Approve Review] Session user:', req.session?.user?.username);

        const reviewId = parseInt(req.params.reviewId, 10);
        if (Number.isNaN(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID' });
        }

        const review = await Review.findByPk(reviewId);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        // Approve the review and set it to public if intended
        await review.update({
            isApproved: true,
            isPublic: review.intendedPublic ? true : review.isPublic
        });

        res.json({
            success: true,
            message: 'Review approved successfully',
            review: {
                id: review.id,
                gameTitle: review.gameTitle,
                isPublic: review.isPublic,
                isApproved: review.isApproved
            }
        });
            } catch (error) {
        console.error('Error approving review:', error);
        res.status(500).json({ error: 'Failed to approve review' });
    }
});

app.post('/api/admin/reviews/:reviewId/reject', requireAdmin, async (req, res) => {
    try {
        console.log('[Reject Review] Endpoint called');
        console.log('[Reject Review] Review ID:', req.params.reviewId);
        console.log('[Reject Review] Request body:', req.body);
        console.log('[Reject Review] Session user:', req.session?.user?.username);
        
        const reviewId = parseInt(req.params.reviewId, 10);
        if (Number.isNaN(reviewId)) {
            console.log('[Reject Review] Invalid review ID');
            return res.status(400).json({ success: false, error: 'Invalid review ID' });
        }

        const { reason } = req.body;
        if (!reason || !reason.trim()) {
            console.log('[Reject Review] Missing rejection reason');
            return res.status(400).json({ success: false, error: 'Rejection reason is required' });
        }

        const review = await Review.findByPk(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, error: 'Review not found' });
        }

        // Reject the review and store the reason
        await review.update({
            isApproved: false,
            isPublic: false,
            rejectionReason: reason.trim()
        });

        res.json({
            success: true,
            message: 'Review rejected successfully',
            review: {
                id: review.id,
                gameTitle: review.gameTitle,
                isPublic: review.isPublic,
                isApproved: review.isApproved,
                rejectionReason: review.rejectionReason
            }
        });
            } catch (error) {
        console.error('Error rejecting review:', error);
        res.status(500).json({ success: false, error: 'Failed to reject review' });
    }
});

// ===== Community Page Route =====
app.get('/community', (req, res) => {
    console.log('[Community Route] Session user:', req.session.user ? req.session.user.username : 'none');
    // Touch session to keep it alive
    if (req.session) {
        req.session.touch();
        // Save session to persist it
        req.session.save((err) => {
            if (err) {
                console.error('[Community Route] Error saving session:', err);
            }
        });
    }
    res.render('community', {
        activePage: 'community',
        user: req.session.user || null,
        title: 'Community - Game Vault'
    });
});

// ===== Community API Routes =====
// Get all posts
app.get('/api/community/posts', async (req, res) => {
    try {
        console.log('[Community Posts] Request received:', req.query);
        const page = parseInt(req.query.page, 10) || 1;
        const pageSize = parseInt(req.query.pageSize, 10) || 20;
        const category = req.query.category || 'all';
        const sortBy = req.query.sortBy || 'newest';
        const gameFilter = req.query.game ? String(req.query.game).toLowerCase() : null;

        const where = {};
        if (category !== 'all') {
            where.category = category;
        }
        if (gameFilter) {
            where.gameTitle = { [Op.iLike]: `%${gameFilter}%` };
        }

        const order = [];
        switch (sortBy) {
            case 'newest':
                order.push(['createdAt', 'DESC']);
                break;
            case 'oldest':
                order.push(['createdAt', 'ASC']);
                break;
            case 'most-liked':
                order.push(['likes', 'DESC']);
                order.push(['createdAt', 'DESC']);
                break;
            case 'most-viewed':
                order.push(['views', 'DESC']);
                order.push(['createdAt', 'DESC']);
                break;
            case 'most-commented':
                // Will sort after fetching
                order.push(['createdAt', 'DESC']);
                break;
            default:
                order.push(['createdAt', 'DESC']);
        }

        // First get pinned posts
        let pinnedPosts = [];
        let posts = [];
        let count = 0;
        
        try {
            pinnedPosts = await Post.findAll({
                where: { ...where, isPinned: true },
                include: [{ model: User, as: 'user', attributes: ['user_id', 'username'], required: false }],
                order: [['createdAt', 'DESC']]
            });

            // Then get regular posts
            const result = await Post.findAndCountAll({
                where: { ...where, isPinned: false },
                include: [{ model: User, as: 'user', attributes: ['user_id', 'username'], required: false }],
                order: order,
                limit: pageSize,
                offset: (page - 1) * pageSize
            });
            count = result.count;
            posts = result.rows;
        } catch (dbError) {
            // If table doesn't exist, return empty results
            if (dbError.name === 'SequelizeDatabaseError' && dbError.message.includes('does not exist')) {
                console.log('[Community Posts] Tables do not exist yet. Returning empty results.');
                return res.json({
                    success: true,
                    posts: [],
                    total: 0,
                    page: 1,
                    pageSize: pageSize,
                    totalPages: 0
                });
            }
            throw dbError; // Re-throw if it's a different error
        }

        // Get comment counts for each post
        const postIds = [...pinnedPosts.map(p => p.id), ...posts.map(p => p.id)];
        let commentCounts = [];
        const commentCountMap = {};
        
        if (postIds.length > 0) {
            try {
                commentCounts = await Comment.findAll({
                    where: { postId: { [Op.in]: postIds } },
                    attributes: ['postId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                    group: ['postId'],
                    raw: true
                });
                
                commentCounts.forEach(cc => {
                    commentCountMap[cc.postId] = parseInt(cc.count) || 0;
                });
            } catch (commentError) {
                console.error('[Community Posts] Error fetching comment counts:', commentError);
                // Continue without comment counts if query fails
            }
        }

        // Combine and format posts
        const allPosts = [...pinnedPosts, ...posts].map(post => {
            const plain = post.toJSON ? post.toJSON() : post;
            return {
                id: plain.id,
                title: plain.title,
                content: plain.content,
                gameTitle: plain.gameTitle,
                category: plain.category,
                tags: Array.isArray(plain.tags) ? plain.tags : [],
                likes: plain.likes || 0,
                views: plain.views || 0,
                isPinned: plain.isPinned || false,
                isLocked: plain.isLocked || false,
                createdAt: plain.createdAt,
                updatedAt: plain.updatedAt,
                user: plain.user ? {
                    id: plain.user.user_id || plain.user.id,
                    username: plain.user.username || 'Anonymous'
                } : null,
                commentCount: commentCountMap[plain.id] || 0
            };
        });

        // Sort by most commented if needed
        if (sortBy === 'most-commented') {
            allPosts.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return b.commentCount - a.commentCount;
            });
        }

        console.log('[Community Posts] Returning posts:', {
            total: count + pinnedPosts.length,
            postsCount: allPosts.length,
            page,
            pageSize,
            totalPages: Math.ceil((count + pinnedPosts.length) / pageSize)
        });

        res.json({
            success: true,
            posts: allPosts,
            total: count + pinnedPosts.length,
            page,
            pageSize,
            totalPages: Math.ceil((count + pinnedPosts.length) / pageSize)
        });
            } catch (error) {
        console.error('[Community Posts] Error fetching posts:', error);
        console.error('[Community Posts] Error name:', error.name);
        console.error('[Community Posts] Error message:', error.message);
        console.error('[Community Posts] Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch posts',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get single post with comments
app.get('/api/community/posts/:postId', async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        
        // Increment view count
        await Post.increment('views', { where: { id: postId } });

        const post = await Post.findByPk(postId, {
            include: [{ model: User, as: 'user', attributes: ['user_id', 'username'] }]
        });

        if (!post) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        const comments = await Comment.findAll({
            where: { postId: postId, parentCommentId: null },
            include: [
                { model: User, as: 'user', attributes: ['user_id', 'username'] },
                {
                    model: Comment,
                    as: 'replies',
                    include: [{ model: User, as: 'user', attributes: ['user_id', 'username'] }],
                    order: [['createdAt', 'ASC']]
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        const plainPost = post.toJSON ? post.toJSON() : post;
        res.json({
            success: true,
            post: {
                ...plainPost,
                user: plainPost.user ? {
                    id: plainPost.user.user_id || plainPost.user.id,
                    username: plainPost.user.username || 'Anonymous'
                } : null
            },
            comments: comments.map(comment => {
                const plain = comment.toJSON ? comment.toJSON() : comment;
                return {
                    ...plain,
                    user: plain.user ? {
                        id: plain.user.user_id || plain.user.id,
                        username: plain.user.username || 'Anonymous'
                    } : null,
                    replies: (plain.replies || []).map(reply => {
                        const plainReply = reply.toJSON ? reply.toJSON() : reply;
                        return {
                            ...plainReply,
                            user: plainReply.user ? {
                                id: plainReply.user.user_id || plainReply.user.id,
                                username: plainReply.user.username || 'Anonymous'
                            } : null
                        };
                    })
                };
            })
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch post' });
    }
});

// Create new post
app.post('/api/community/posts', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const userId = req.session.user.id || req.session.user.user_id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Invalid user session' });
        }

        const { title, content, gameTitle, category, tags } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content are required' });
        }

        if (title.length < 3 || title.length > 200) {
            return res.status(400).json({ success: false, error: 'Title must be between 3 and 200 characters' });
        }

        if (content.length < 10 || content.length > 10000) {
            return res.status(400).json({ success: false, error: 'Content must be between 10 and 10000 characters' });
        }

        const post = await Post.create({
            userId: userId,
            title: title.trim(),
            content: content.trim(),
            gameTitle: gameTitle ? gameTitle.trim() : null,
            category: category || 'general',
            tags: Array.isArray(tags) ? tags : []
        });

        const createdPost = await Post.findByPk(post.id, {
            include: [{ model: User, as: 'user', attributes: ['user_id', 'username'] }]
        });

        const plain = createdPost.toJSON ? createdPost.toJSON() : createdPost;
        res.json({
            success: true,
            post: {
                ...plain,
                user: plain.user ? {
                    id: plain.user.user_id || plain.user.id,
                    username: plain.user.username || 'Anonymous'
                } : null,
                commentCount: 0
            }
        });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ success: false, error: 'Failed to create post' });
    }
});

// Add comment to post
app.post('/api/community/posts/:postId/comments', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const userId = req.session.user.id || req.session.user.user_id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Invalid user session' });
        }

        const postId = parseInt(req.params.postId, 10);
        const { content, parentCommentId } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Comment content is required' });
        }

        if (content.length > 5000) {
            return res.status(400).json({ success: false, error: 'Comment must be less than 5000 characters' });
        }

        // Check if post exists and is not locked
        const post = await Post.findByPk(postId);
        if (!post) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        if (post.isLocked) {
            return res.status(403).json({ success: false, error: 'Post is locked' });
        }

        const comment = await Comment.create({
            postId: postId,
            userId: userId,
            content: content.trim(),
            parentCommentId: parentCommentId || null
        });

        const createdComment = await Comment.findByPk(comment.id, {
            include: [{ model: User, as: 'user', attributes: ['user_id', 'username'] }]
        });

        const plain = createdComment.toJSON ? createdComment.toJSON() : createdComment;
        res.json({
            success: true,
            comment: {
                ...plain,
                user: plain.user ? {
                    id: plain.user.user_id || plain.user.id,
                    username: plain.user.username || 'Anonymous'
                } : null,
                replies: []
            }
        });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ success: false, error: 'Failed to create comment' });
    }
});

// Like post
app.post('/api/community/posts/:postId/like', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const postId = parseInt(req.params.postId, 10);
        await Post.increment('likes', { where: { id: postId } });
        
        const post = await Post.findByPk(postId);
        res.json({ success: true, likes: post.likes });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ success: false, error: 'Failed to like post' });
    }
});

// Like comment
app.post('/api/community/comments/:commentId/like', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const commentId = parseInt(req.params.commentId, 10);
        await Comment.increment('likes', { where: { id: commentId } });
        
        const comment = await Comment.findByPk(commentId);
        res.json({ success: true, likes: comment.likes });
    } catch (error) {
        console.error('Error liking comment:', error);
        res.status(500).json({ success: false, error: 'Failed to like comment' });
    }
});

// ===== Public Reviews API =====
app.get('/api/reviews/public', async (req, res) => {
    try {
        console.log('[Public Reviews] Request received:', req.query);
        const rawPage = parseInt(req.query.page, 10);
        const rawPageSize = parseInt(req.query.pageSize, 10);
        const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
        const pageSize = Number.isNaN(rawPageSize) || rawPageSize < 1 ? 12 : Math.min(rawPageSize, 30);
        const minRating = parseInt(req.query.minRating, 10);
        const tagFilter = req.query.tag ? String(req.query.tag).toLowerCase() : null;
        const gameFilter = req.query.game ? String(req.query.game).toLowerCase() : null;
        const sortOption = req.query.sort || 'newest';

        console.log('[Public Reviews] Filters:', { page, pageSize, minRating, tagFilter, gameFilter, sortOption });

        // Only show approved public reviews
        const reviews = await Review.findAll({
            where: { 
                isPublic: true,
                isApproved: true  // Only show approved reviews
            },
            include: [{ 
                model: User, 
                as: 'user', 
                attributes: ['user_id', 'username'],
                required: false  // Left join - don't fail if user doesn't exist
            }],
            raw: false  // Get Sequelize instances to access associations
        });

        console.log('[Public Reviews] Found reviews:', reviews.length);

        // Convert to plain objects for easier manipulation
        let filtered = reviews.map(review => {
            const plain = review.toJSON ? review.toJSON() : review;
            // Ensure rating is a number
            if (plain.rating != null) {
                plain.rating = parseFloat(plain.rating) || 0;
            }
            // Ensure tags is an array
            if (!Array.isArray(plain.tags)) {
                plain.tags = plain.tags ? [plain.tags] : [];
            }
            // Extract user data safely
            if (plain.user) {
                plain.user = {
                    id: plain.user.user_id || plain.user.id || null,
                    username: plain.user.username || 'Anonymous'
                };
            } else {
                plain.user = null;
            }
            return plain;
        });

        if (!Number.isNaN(minRating) && minRating >= 1 && minRating <= 5) {
            filtered = filtered.filter(review => review.rating >= minRating);
        }

        if (tagFilter) {
            filtered = filtered.filter(review => {
                if (!review.tags || review.tags.length === 0) return false;
                return review.tags.map(tag => String(tag).toLowerCase()).includes(tagFilter);
            });
        }

        if (gameFilter) {
            filtered = filtered.filter(review => {
                if (!review.gameTitle) return false;
                return String(review.gameTitle).toLowerCase().includes(gameFilter);
            });
            console.log('[Public Reviews] After game filter:', filtered.length, 'reviews match:', gameFilter);
        }

        switch (sortOption) {
            case 'oldest':
                filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'rating-desc':
                filtered.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
                break;
            case 'rating-asc':
                filtered.sort((a, b) => parseFloat(a.rating) - parseFloat(b.rating));
                break;
            case 'helpful':
                filtered.sort((a, b) => (b.helpfulVotes || 0) - (a.helpfulVotes || 0));
                break;
            case 'alpha':
                filtered.sort((a, b) => (a.gameTitle || '').localeCompare(b.gameTitle || ''));
                break;
            case 'newest':
            default:
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
        }

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const currentPage = Math.min(page, totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const pageReviews = filtered.slice(startIndex, startIndex + pageSize);

        console.log('[Public Reviews] Response:', { total, currentPage, totalPages, pageReviewsCount: pageReviews.length });

        res.json({
            success: true,
            page: currentPage,
            pageSize,
            total,
            totalPages,
            reviews: pageReviews.map(review => ({
                id: review.id,
                gameTitle: review.gameTitle,
                rating: parseFloat(review.rating) || 0,
                reviewText: review.reviewText,
                tags: Array.isArray(review.tags) ? review.tags : [],
                helpfulVotes: review.helpfulVotes || 0,
                isPublic: review.isPublic,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                user: review.user
            }))
        });
    } catch (error) {
        console.error('[Public Reviews] Error fetching public reviews:', error);
        console.error('[Public Reviews] Error name:', error.name);
        console.error('[Public Reviews] Error message:', error.message);
        console.error('[Public Reviews] Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch public reviews',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

app.listen(PORT, async () => {
    console.log(`🎮 Game Vault Profile System running on http://localhost:${PORT}`);
    console.log(`📊 Admin panel available at http://localhost:${PORT}`);
    console.log(`✅ Server ready - create your own users!`);

    console.log('🔄 Waiting for database initialization...');
    const checkDatabase = setInterval(async () => {
        if (profileManager.isInitialized) {
            clearInterval(checkDatabase);
            isDatabaseReady = true;
            console.log('✅ Database connection established!');
            
            // Run migration to add avatar_path column if it doesn't exist
            try {
                const addAvatarColumn = require('./server/migrations/add-avatar-column');
                await addAvatarColumn();
            } catch (error) {
                console.error('⚠️ Migration error (may be harmless if column already exists):', error.message);
            }
            
            // Run migration to add profile_picture_path column if it doesn't exist
            try {
                const addProfilePictureColumn = require('./server/migrations/add-profile-picture-column');
                await addProfilePictureColumn();
            } catch (error) {
                console.error('⚠️ Migration error (may be harmless if column already exists):', error.message);
            }
            
            console.log(`✅ Database ready for new users!`);
            
            // Preload Steam app list in the background for faster searches
            console.log('🔄 Preloading Steam app list (this may take 30-60 seconds)...');
            gameSearchService.getSteamAppList()
                .then(appList => {
                    if (appList && appList.length > 0) {
                        console.log(`✅ Steam app list preloaded successfully with ${appList.length} games`);
                    } else {
                        console.warn('⚠️ Steam app list preload returned empty or null');
                    }
                })
                .catch(error => {
                    console.error('❌ Error preloading Steam app list:', error.message);
                    console.log('   Searches will still work, but may be slower on first use');
                });
        }
    }, 100);

    setTimeout(() => {
        if (!isDatabaseReady) {
            clearInterval(checkDatabase);
            console.error('❌ Database initialization timeout. Server running with limited functionality.');
        }
    }, 10000);
});

app.post('/api/reviews/:reviewId/helpful', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const reviewId = parseInt(req.params.reviewId, 10);
        if (Number.isNaN(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID' });
        }

        const review = await Review.findByPk(reviewId);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        if (review.userId === req.session.user.id) {
            return res.status(400).json({ error: 'You cannot mark your own review as helpful' });
        }

        const [vote, created] = await ReviewHelpfulVote.findOrCreate({
            where: {
                reviewId: reviewId,
                userId: req.session.user.id
            }
        });

        if (!created) {
            return res.status(400).json({ error: 'You have already marked this review as helpful' });
        }

        await review.increment('helpfulVotes', { by: 1 });
        await review.reload();

        res.json({ success: true, message: 'Thanks for your feedback!', helpfulVotes: review.helpfulVotes });
    } catch (error) {
        console.error('Error adding helpful vote:', error);
        res.status(500).json({ error: 'Failed to update helpful vote' });
    }
});

app.delete('/api/reviews/:reviewId/helpful', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const reviewId = parseInt(req.params.reviewId, 10);
        if (Number.isNaN(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID' });
        }

        const vote = await ReviewHelpfulVote.findOne({
            where: {
                reviewId: reviewId,
                userId: req.session.user.id
            }
        });

        if (!vote) {
            return res.status(400).json({ error: 'You have not marked this review as helpful yet' });
        }

        const review = await Review.findByPk(reviewId);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        await vote.destroy();
        if (review.helpfulVotes > 0) {
            await review.decrement('helpfulVotes', { by: 1 });
        }
        await review.reload();

        res.json({ success: true, message: 'Helpful vote removed', helpfulVotes: Math.max(review.helpfulVotes, 0) });
    } catch (error) {
        console.error('Error removing helpful vote:', error);
        res.status(500).json({ error: 'Failed to update helpful vote' });
    }
});

app.get('/reviews', (req, res) => res.render('reviews'));
app.get('/reviews/public/:reviewId', async (req, res) => {
    try {
        const reviewId = parseInt(req.params.reviewId, 10);
        if (Number.isNaN(reviewId)) {
            return res.status(400).render('public-review', { review: null, error: 'Invalid review ID provided.' });
        }

        const review = await Review.findOne({
            where: {
                id: reviewId,
                isPublic: true
            },
            include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
        });

        if (!review) {
            return res.status(404).render('public-review', { review: null, error: 'This review could not be found or is private.' });
        }

        res.render('public-review', {
            review: {
                id: review.id,
                gameTitle: review.gameTitle,
                rating: review.rating,
                reviewText: review.reviewText,
                tags: Array.isArray(review.tags) ? review.tags : [],
                helpfulVotes: review.helpfulVotes || 0,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                author: review.user ? review.user.username : 'Unknown Player'
            },
            error: null
        });
    } catch (error) {
        console.error('Error rendering public review page:', error);
        res.status(500).render('public-review', { review: null, error: 'An unexpected error occurred while loading this review.' });
    }
});
app.get('/admin', (req, res) => res.render('admin'));

const normalizeReviewTags = (tagsInput) => {
    if (!tagsInput) {
        return [];
    }

    let rawTags = [];
    if (Array.isArray(tagsInput)) {
        rawTags = tagsInput;
    } else if (typeof tagsInput === 'string') {
        rawTags = tagsInput.split(',');
    } else {
        return [];
    }

    const seen = new Set();
    const cleaned = [];

    rawTags.forEach(tag => {
        if (tag === undefined || tag === null) {
            return;
        }
        let trimmed = String(tag).trim();
        if (!trimmed) {
            return;
        }
        if (trimmed.length > 40) {
            trimmed = trimmed.substring(0, 40);
        }
        const key = trimmed.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            cleaned.push(trimmed);
        }
    });

    return cleaned.slice(0, 12);
};

module.exports = app;

