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
const { Review } = require('./server/models/index');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'game-vault-secret-key',
    resave: true,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true, // Prevent client-side access to cookies
        sameSite: 'lax', // CSRF protection - allow cookies during Steam OAuth redirect
        domain: undefined // Allow cookies for localhost
    }
}));

app.use((req, res, next) => {
    console.log('Session middleware - Session ID:', req.sessionID);
    console.log('Session middleware - Session user:', req.session.user);
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
const adminManager = new AdminManager();
const gameSearchService = new GameSearchService();
const steamService = new SteamService();

app.use(passport.initialize());
app.use(passport.session());

passport.use(new SteamStrategy({
    returnURL: process.env.STEAM_RETURN_URL || 'http://localhost:3000/api/auth/steam/return',
    realm: process.env.STEAM_REALM || 'http://localhost:3000',
    apiKey: process.env.STEAM_API_KEY || 'your-steam-api-key-here'
}, async (identifier, profile, done) => {
    try {

        const steamId = identifier.split('/').pop();

        return done(null, {
            steamId: steamId,
            profile: {
                id: steamId,
                username: profile.displayName,
                photos: profile.photos,
                profileUrl: profile._json.profileurl
            }
        });
    } catch (error) {
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
    else if (pathName.startsWith('/wishlist')) res.locals.activePage = 'wishlist';
    else if (pathName.startsWith('/reviews')) res.locals.activePage = 'reviews';
    else if (pathName.startsWith('/settings')) res.locals.activePage = 'settings';
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

// Settings page
app.get('/settings', (req, res) => {
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
        console.log('Loading profile for username:', username);
        
        // Load user data directly from database to avoid caching issues
        const { User } = require('./server/models/index');
        const dbUser = await User.findOne({ where: { username } });
        
        if (dbUser) {
            console.log('User found in database:', dbUser.username);
            console.log('User Steam ID from database:', dbUser.steam_id);
            console.log('User Steam profile from database:', dbUser.steam_profile ? 'present' : 'missing');
            
            // Use statistics from database if available, otherwise calculate from Steam games
            let totalGames = 0;
            let totalPlaytime = 0;
            let achievementCount = 0;
            let avgRating = 0;
            let steamLinked = false;
            let steamGames = null; // Will be used for profile.steam_games
            
            if (dbUser.steam_id) {
                steamLinked = true;
                console.log('User has Steam account linked:', dbUser.steam_id);
                
                // Always calculate from steam_games if available, as it's more accurate
                // Ensure steam_games is an array (JSONB might need parsing)
                steamGames = dbUser.steam_games;
                if (steamGames && !Array.isArray(steamGames)) {
                    try {
                        steamGames = typeof steamGames === 'string' ? JSON.parse(steamGames) : steamGames;
                    } catch (e) {
                        console.error('Error parsing steam_games:', e);
                        steamGames = null;
                    }
                }
                
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
                
                // Always prefer database statistics if available and games array is empty/not synced yet
                // This ensures we show the correct values even if steam_games hasn't been loaded
                if ((totalGames === 0 || !steamGames || steamGames.length === 0) && dbUser.statistics) {
                    const dbStats = dbUser.statistics;
                    if (dbStats.totalGamesPlayed > 0) totalGames = dbStats.totalGamesPlayed;
                    if (dbStats.totalPlaytime > 0) totalPlaytime = dbStats.totalPlaytime;
                    if (dbStats.totalAchievements > 0) achievementCount = dbStats.totalAchievements;
                    if (dbStats.averageRating > 0) avgRating = dbStats.averageRating;
                    
                    console.log('Statistics loaded from database (games array empty or not synced):', { 
                        totalGames, 
                        totalPlaytime, 
                        achievementCount,
                        avgRating,
                        dbStatsPresent: !!dbStats
                    });
                }
                
                if (totalGames === 0) {
                    console.log('No Steam games or statistics found for user:', dbUser.username);
                    console.log('steam_games value:', dbUser.steam_games);
                    console.log('steam_games type:', typeof dbUser.steam_games, 'isArray:', Array.isArray(dbUser.steam_games));
                    console.log('statistics value:', dbUser.statistics);
                }
            } else {
                console.log('No Steam account linked for user:', dbUser.username);
            }
            
            // Convert database format to profile format
            profile = {
                username: dbUser.username,
                email: dbUser.email,
                joinDate: dbUser.join_date,
                totalGames: totalGames,
                totalPlaytime: totalPlaytime,
                avgRating: avgRating,
                achievementCount: achievementCount,
                bio: dbUser.bio || '',
                playStyle: dbUser.gaming_preferences?.playStyle || '',
                favoriteGenres: dbUser.gaming_preferences?.favoriteGenres || [],
                preferredPlatforms: dbUser.gaming_preferences?.preferredPlatforms || [],
                achievements: [], // Achievements are stored separately in the achievements table
                steamLinked: steamLinked,
                steam_id: dbUser.steam_id,
                steam_profile: dbUser.steam_profile,
                steam_games: (steamGames && Array.isArray(steamGames)) ? steamGames : (Array.isArray(dbUser.steam_games) ? dbUser.steam_games : []), // Ensure it's always an array
                steam_last_sync: dbUser.steam_last_sync,
                avatar_path: dbUser.avatar_path || null, // Will use placeholder if null
                isCurrentUser: req.session.user && req.session.user.username === username
            };
            
            // Ensure statistics are always numbers, not undefined
            if (typeof profile.totalGames === 'undefined' || profile.totalGames === null) profile.totalGames = 0;
            if (typeof profile.totalPlaytime === 'undefined' || profile.totalPlaytime === null) profile.totalPlaytime = 0;
            if (typeof profile.avgRating === 'undefined' || profile.avgRating === null) profile.avgRating = 0;
            
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

                profile = {
                    username: req.session.user.username,
                    email: req.session.user.email || '',
                    joinDate: req.session.user.joinDate || '',
                    totalGames: totalGames,
                    totalPlaytime: Math.round(totalPlaytime / 60),
                    avgRating: avgRating || 0,
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
            steamLinked: profile.steamLinked,
            totalGames: profile.totalGames,
            totalPlaytime: profile.totalPlaytime,
            achievementCount: profile.achievementCount
        });

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
    if (req.session.user && req.session.user.username) {
        res.redirect(`/profile/${req.session.user.username}`);
    } else {
        res.redirect('/');
    }
});

app.get('/search', (req, res) => {
    console.log('Search route hit with query:', req.query.q);
    res.render('search');
});
app.get('/friends', (req, res) => res.render('friends'));
app.get('/wishlist', (req, res) => res.render('wishlist'));
app.get('/reviews', (req, res) => res.render('reviews'));
app.get('/admin', (req, res) => res.render('admin'));

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
            const { User } = require('./server/models/index');
            const dbUser = await User.findOne({ where: { username: username } });
            
            // Store complete user data in session
            req.session.user = {
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

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

app.get('/api/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
});

app.get('/api/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), async (req, res) => {
    try {
        console.log('Steam OAuth return - Processing Steam authentication...');
        console.log('Session user at return:', req.session.user);
        console.log('Passport user:', req.user);
        console.log('Stored Steam link user info:', req.session.steamLinkUser);
        
        if (req.user && req.user.steamId) {
            // Try to get full Steam profile with API key, but use basic info from OAuth if it fails
            let steamProfile = null;
            const steamProfileResult = await steamService.getUserProfile(req.user.steamId);
            if (steamProfileResult.success) {
                console.log('Steam profile fetched successfully via API:', steamProfileResult.profile.personaname);
                steamProfile = steamProfileResult.profile;
            } else {
                console.log('Steam API key not available or failed, using basic profile from OAuth:', steamProfileResult.error);
                // Use basic profile info from passport strategy if API call fails
                steamProfile = {
                    steamid: req.user.steamId,
                    personaname: req.user.profile.username || 'Steam User',
                    profileurl: req.user.profile.profileUrl || `https://steamcommunity.com/profiles/${req.user.steamId}`,
                    avatar: req.user.profile.photos?.[0]?.value || null,
                    avatarmedium: req.user.profile.photos?.[1]?.value || null,
                    avatarfull: req.user.profile.photos?.[2]?.value || null
                };
                console.log('Using basic Steam profile from OAuth:', steamProfile.personaname);
            }
            
            // Check if user is already logged in
            if (req.session.user && req.session.user.username) {
                console.log('Linking Steam to existing user:', req.session.user.username);
                
                // Link Steam account to existing account
                const user = await profileManager.getUserByUsername(req.session.user.username);
                if (user) {
                    // Check if user already has Steam linked
                    if (user.steam_id) {
                        console.log('User already has Steam account linked:', user.steam_id);
                        // Just reload the data
                        const updatedUser = await profileManager.getUserByUsername(req.session.user.username);
                        req.session.user = {
                            username: updatedUser.username,
                            email: updatedUser.email,
                            joinDate: updatedUser.joinDate,
                            bio: updatedUser.bio,
                            gamingPreferences: updatedUser.gamingPreferences,
                            statistics: updatedUser.statistics,
                            achievements: updatedUser.achievements,
                            steam_id: updatedUser.steam_id,
                            steam_profile: updatedUser.steam_profile,
                            steam_games: updatedUser.steam_games,
                            steam_last_sync: updatedUser.steam_last_sync
                        };
                    } else {
                        // Link Steam account and auto-import games
                        const { User } = require('./server/models/index');
                        const dbUser = await User.findOne({ where: { username: req.session.user.username } });
                        if (dbUser) {
                            const linkResult = await steamService.linkSteamAccount(dbUser, req.user.steamId, steamProfile);
                            console.log('Steam account linked:', linkResult);
                            
                            if (!linkResult.success) {
                                console.error('Failed to link Steam account:', linkResult.error);
                            }
                            
                            // Wait a moment to ensure database commit
                            await new Promise(resolve => setTimeout(resolve, 200));
                            
                            // Reload user data from database using databaseManager directly to get fresh data
                            const updatedUser = await User.findOne({ 
                                where: { username: req.session.user.username },
                                attributes: ['id', 'username', 'email', 'join_date', 'bio', 'gaming_preferences', 'statistics', 'achievements', 'steam_id', 'steam_profile', 'steam_games', 'steam_last_sync']
                            });
                            
                            if (!updatedUser) {
                                console.error('Failed to reload user after Steam linking');
                                throw new Error('Failed to reload user data');
                            }
                            
                            console.log('Reloaded user from database - Steam ID:', updatedUser.steam_id);
                            console.log('Reloaded user - Steam profile:', updatedUser.steam_profile ? 'present' : 'missing');
                            
                            // Convert database format to profile format
                            const userData = {
                                username: updatedUser.username,
                                email: updatedUser.email,
                                joinDate: updatedUser.join_date,
                                bio: updatedUser.bio,
                                gamingPreferences: updatedUser.gaming_preferences,
                                statistics: updatedUser.statistics,
                                achievements: updatedUser.achievements,
                                steam_id: updatedUser.steam_id,
                                steam_profile: updatedUser.steam_profile,
                                steam_games: updatedUser.steam_games,
                                steam_last_sync: updatedUser.steam_last_sync
                            };
                            
                            // Update session with complete user data
                            req.session.user = {
                                username: userData.username,
                                email: userData.email,
                                joinDate: userData.joinDate,
                                bio: userData.bio,
                                gamingPreferences: userData.gamingPreferences,
                                statistics: userData.statistics,
                                achievements: userData.achievements,
                                steam_id: userData.steam_id,
                                steam_profile: userData.steam_profile,
                                steam_games: userData.steam_games,
                                steam_last_sync: userData.steam_last_sync
                            };
                            
                            console.log('Session updated - steam_id:', req.session.user.steam_id);
                            console.log('Session updated - steam_profile:', req.session.user.steam_profile ? 'present' : 'missing');
                        }
                    }
                    
                    console.log('Session updated with complete user data including Steam info');
                    
                    // Force session save before redirect
                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session:', err);
                        } else {
                            console.log('Session saved successfully');
                        }
                    });
                } else {
                    console.error('User not found in database for linking');
                }
            } else if (req.session.steamLinkUser && req.session.steamLinkUser.username) {
                    // Session user was lost, but we have the Steam link user info
                    console.log('Session user lost, using stored Steam link user:', req.session.steamLinkUser.username);
                    
                    const user = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                    if (user) {
                        // Link Steam account and auto-import games
                        const { User } = require('./server/models/index');
                        const dbUser = await User.findOne({ where: { username: req.session.steamLinkUser.username } });
                        if (dbUser) {
                            const linkResult = await steamService.linkSteamAccount(dbUser, req.user.steamId, steamProfile);
                            console.log('Steam account linked to stored user:', linkResult);
                            
                            // Reload user data from database to get all fields including Steam data
                            const updatedUser = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                            
                            // Create session with complete user data
                            req.session.user = {
                                username: updatedUser.username,
                                email: updatedUser.email,
                                joinDate: updatedUser.joinDate,
                                bio: updatedUser.bio,
                                gamingPreferences: updatedUser.gamingPreferences,
                                statistics: updatedUser.statistics,
                                achievements: updatedUser.achievements,
                                steam_id: updatedUser.steam_id,
                                steam_profile: updatedUser.steam_profile,
                                steam_games: updatedUser.steam_games,
                                steam_last_sync: updatedUser.steam_last_sync
                            };
                            
                            // Clear the stored Steam link user info
                            delete req.session.steamLinkUser;
                            
                            console.log('Session restored with complete user data including Steam info');
                        }
                    }
                } else {
                    console.log('Session user is undefined, checking stored Steam link user info...');

                    if (req.session.steamLinkUser && req.session.steamLinkUser.username) {
                        console.log('Using stored Steam link user info:', req.session.steamLinkUser.username);
                        
                        const user = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                        if (user) {

                            if (user.steam_id) {
                                console.log('User already has Steam account linked:', user.steam_id);

                                const updatedUser = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                                req.session.user = {
                                    username: updatedUser.username,
                                    email: updatedUser.email,
                                    joinDate: updatedUser.joinDate,
                                    bio: updatedUser.bio,
                                    gamingPreferences: updatedUser.gamingPreferences,
                                    statistics: updatedUser.statistics,
                                    achievements: updatedUser.achievements,
                                    steam_id: updatedUser.steam_id,
                                    steam_profile: updatedUser.steam_profile,
                                    steam_games: updatedUser.steam_games,
                                    steam_last_sync: updatedUser.steam_last_sync
                                };
                            } else {
                                // Link Steam account and auto-import games
                                const { User } = require('./server/models/index');
                                const dbUser = await User.findOne({ where: { username: req.session.steamLinkUser.username } });
                                if (dbUser) {
                                    const linkResult = await steamService.linkSteamAccount(dbUser, req.user.steamId, steamProfile);
                                    console.log('Steam account linked to stored user:', linkResult);
                                    
                                    // Reload user data from database to get all fields including Steam data
                                    const updatedUser = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                                    
                                    // Create session with complete user data
                                    req.session.user = {
                                        username: updatedUser.username,
                                        email: updatedUser.email,
                                        joinDate: updatedUser.joinDate,
                                        bio: updatedUser.bio,
                                        gamingPreferences: updatedUser.gamingPreferences,
                                        statistics: updatedUser.statistics,
                                        achievements: updatedUser.achievements,
                                        steam_id: updatedUser.steam_id,
                                        steam_profile: updatedUser.steam_profile,
                                        steam_games: updatedUser.steam_games,
                                        steam_last_sync: updatedUser.steam_last_sync
                                    };
                                }
                            }
                            
                            // Clear the stored Steam link user info
                            delete req.session.steamLinkUser;
                            
                            console.log('Session restored with complete user data including Steam info');
                        }
                    } else {
                        // Fallback: Try to match Steam username with existing user
                        console.log('No stored Steam link user info, trying to match Steam username with existing user...');
                        const steamUsername = steamProfile.personaname;
                        console.log('Steam username:', steamUsername);
                        
                        // Try to find user by username that matches Steam username
                        const matchingUser = await profileManager.getUserByUsername(steamUsername);
                        if (matchingUser && !matchingUser.steam_id) {
                            console.log('Found matching user without Steam linked:', matchingUser.username);
                            
                            // Link Steam account to the matching user
                            const { User } = require('./server/models/index');
                            const dbUser = await User.findOne({ where: { username: matchingUser.username } });
                            if (dbUser) {
                                const linkResult = await steamService.linkSteamAccount(dbUser, req.user.steamId, steamProfile);
                                console.log('Steam account linked to matching user:', linkResult);
                                
                                // Reload user data from database to get all fields including Steam data
                                const updatedUser = await profileManager.getUserByUsername(matchingUser.username);
                                
                                // Create session with complete user data
                                req.session.user = {
                                    username: updatedUser.username,
                                    email: updatedUser.email,
                                    joinDate: updatedUser.joinDate,
                                    bio: updatedUser.bio,
                                    gamingPreferences: updatedUser.gamingPreferences,
                                    statistics: updatedUser.statistics,
                                    achievements: updatedUser.achievements,
                                    steam_id: updatedUser.steam_id,
                                    steam_profile: updatedUser.steam_profile,
                                    steam_games: updatedUser.steam_games,
                                    steam_last_sync: updatedUser.steam_last_sync
                                };
                                
                                console.log('Session created with complete user data including Steam info');
                            }
                        } else {

                            const existingUser = await profileManager.getUserBySteamId(req.user.steamId);
                            if (existingUser) {
                                console.log('Found existing user with Steam ID:', existingUser.username);

                                const userData = await profileManager.getUserByUsername(existingUser.username);
                                req.session.user = {
                                    username: userData.username,
                                    email: userData.email,
                                    joinDate: userData.joinDate,
                                    bio: userData.bio,
                                    gamingPreferences: userData.gamingPreferences,
                                    statistics: userData.statistics,
                                    achievements: userData.achievements,
                                    steam_id: userData.steam_id,
                                    steam_profile: userData.steam_profile,
                                    steam_games: userData.steam_games,
                                    steam_last_sync: userData.steam_last_sync
                                };
                            } else {
                                console.log('Creating new user account with Steam data');
                                
                                // Create a new user account in the database with Steam data
                                const username = steamProfile.personaname || 'Steam User';
                                const email = steamProfile.personaname ? `${steamProfile.personaname}@steam.local` : 'steam@local.com';
                                
                                // Create user account in database
                                const newUser = await profileManager.createProfile(username, email, 'steam_password', {
                                    playStyle: 'casual',
                                    favoriteGenres: [],
                                    preferredPlatforms: ['PC']
                                });
                                
                                if (newUser) {
                                    // Link Steam account to the new user and auto-import games
                                    const { User } = require('./server/models/index');
                                    const dbNewUser = await User.findOne({ where: { username } });
                                    if (dbNewUser) {
                                        const linkResult = await steamService.linkSteamAccount(dbNewUser, req.user.steamId, steamProfile);
                                        console.log('New user Steam account linked:', linkResult);
                                        
                                        // Reload user data to get Steam games
                                        const userData = await profileManager.getUserByUsername(username);
                                        
                                        // Create session with complete data
                                        req.session.user = {
                                            username: userData.username,
                                            email: userData.email,
                                            joinDate: userData.joinDate,
                                            bio: userData.bio,
                                            gamingPreferences: userData.gamingPreferences,
                                            statistics: userData.statistics,
                                            achievements: userData.achievements,
                                            steam_id: userData.steam_id,
                                            steam_profile: userData.steam_profile,
                                            steam_games: userData.steam_games,
                                            steam_last_sync: userData.steam_last_sync
                                        };
                                    }
                                } else {

                                    req.session.user = {
                                        steam_id: req.user.steamId,
                                        steam_profile: steamProfile,
                                        username: username,
                                        email: email,
                                        isSteamOnly: true
                                    };
                                }
                            }
                        }
                    }
                }
            }
        
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
        console.error('Error processing Steam return:', error);
        res.redirect('/profile?error=steam_auth_failed');
    }
});

app.post('/api/auth/steam/link/:username?', async (req, res) => {
    try {

        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.status(401).json({ error: 'Username required' });
        }

        // Get user directly from database instead of profileManager
        const { User } = require('./server/models/index');
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            console.error('User not found for Steam link:', username);
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.steam_id) {
            return res.status(400).json({ error: 'Steam account already linked' });
        }

        if (req.body.returnUrl) {
            req.session.returnUrl = req.body.returnUrl;
            console.log('Stored return URL:', req.body.returnUrl);
        } else {

            req.session.returnUrl = `/profile/${username}`;
            console.log('Using default return URL:', req.session.returnUrl);
        }

        req.session.steamLinkUser = {
            username: username,
            email: user.email
        };
        console.log('Stored Steam link user info:', req.session.steamLinkUser);

        res.json({ 
            success: true, 
            message: 'Redirecting to Steam authentication',
            redirectUrl: '/api/auth/steam'
        });
    } catch (error) {
        console.error('Error linking Steam account:', error);
        res.status(500).json({ error: 'Failed to link Steam account' });
    }
});

app.post('/api/auth/steam/unlink', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        const user = await profileManager.getUserByUsername(req.session.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await steamService.unlinkSteamAccount(user);
        if (result.success) {

            req.session.user.steam_id = null;
            req.session.user.steam_profile = null;
            res.json({ success: true, message: 'Steam account unlinked successfully' });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error unlinking Steam account:', error);
        res.status(500).json({ error: 'Failed to unlink Steam account' });
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

        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.status(401).json({ error: 'Username required' });
        }

        // Get Sequelize User model instance directly from database
        const { User } = require('./server/models/index');
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        // Unlink Steam account
        user.steam_id = null;
        user.steam_profile = null;
        user.steam_linked_at = null;
        user.steam_games = null;
        user.steam_last_sync = null;
        
        await user.save();

        // Update session if this is the current user
        if (req.session.user && req.session.user.username === username) {
            req.session.user.steam_id = null;
            req.session.user.steam_profile = null;
            req.session.user.steam_games = null;
            req.session.user.steam_last_sync = null;
            req.session.save();
        }

        res.json({ success: true, message: 'Steam account unlinked successfully' });
    } catch (error) {
        console.error('Error unlinking Steam account:', error);
        res.status(500).json({ error: 'Failed to unlink Steam account' });
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

        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.status(401).json({ error: 'Username required' });
        }

        let user = await profileManager.getUserByUsername(username);

        if (!user && req.session.user && req.session.user.username === username) {

            user = {
                username: req.session.user.username,
                steam_id: req.session.user.steam_id,
                steam_profile: req.session.user.steam_profile,
                steam_games: req.session.user.steam_games || []
            };
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
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

app.post('/api/steam/sync/:username?', async (req, res) => {
    try {

        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.status(401).json({ error: 'Username required' });
        }

        const user = await profileManager.databaseManager.getUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found in database' });
        }

        if (!user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        const syncResult = await steamService.syncUserGames(user);
        if (syncResult.success) {

            const updatedUser = await profileManager.databaseManager.getUserByUsername(username);

            if (req.session.user && req.session.user.username === username) {
                req.session.user.statistics = updatedUser.statistics;
                req.session.user.steam_games = updatedUser.steam_games;
                req.session.user.steam_last_sync = updatedUser.steam_last_sync;
                console.log('Session updated with new Steam data');
            }
            
            res.json({ success: true, message: 'Steam library synced successfully', gamesCount: syncResult.gamesCount });
        } else {
            res.status(400).json({ error: syncResult.error });
        }
    } catch (error) {
        console.error('Error syncing Steam library:', error);
        res.status(500).json({ error: 'Failed to sync Steam library' });
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
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        const user = await profileManager.getUserByUsername(req.session.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        profileManager.loadProfile(req.session.user.username);
        const reviewManager = profileManager.getReviewManager();
        
        if (reviewManager) {
            const reviews = reviewManager.getReviews();
            res.json({ success: true, reviews: reviews });
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

// Upload profile avatar
app.post('/api/profile/avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { User } = require('./server/models/index');
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

app.post('/api/wishlists/:username/add-game', async (req, res) => {
    try {
        const { username } = req.params;
        const { gameId, gameName, gameData } = req.body;

        if (!gameId || !gameName) {
            return res.status(400).json({ error: 'Game ID and name are required' });
        }

        profileManager.loadProfile(username);
        const wishlistManager = profileManager.getWishlistManager();

        if (!wishlistManager) {
            return res.status(404).json({ error: 'Wishlist manager not found' });
        }

        const defaultWishlist = wishlistManager.getWishlists().find(w => w.name === 'Default') || 
                               wishlistManager.createWishlist('Default', 'Default wishlist');
        
        const gameAdded = wishlistManager.addGameToWishlist(defaultWishlist.id, {
            id: gameId,
            name: gameName,
            ...gameData
        });

        if (gameAdded) {
            res.json({ 
                success: true, 
                message: 'Game added to wishlist',
                game: { id: gameId, name: gameName }
            });
        } else {
            res.status(400).json({ error: 'Failed to add game to wishlist' });
        }
    } catch (error) {
        console.error('Error adding game to wishlist:', error);
        res.status(500).json({ error: 'Internal server error' });
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

        if (req.session.user && req.session.user.steam_id) {
            const user = await profileManager.getUserByUsername(req.session.user.username);
            if (user && user.steam_games) {
                result.games = steamService.getSteamOwnershipStatus(user, result.games);
            }
        }
        
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

        const { User } = require('./server/models/index');
        const user = await User.findOne({ where: { username: req.session.user.username } });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return user settings (stored in user preferences or as separate field)
        const settings = user.settings || {};
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

        const { User } = require('./server/models/index');
        const user = await User.findOne({ where: { username: req.session.user.username } });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Save settings (could be stored in gaming_preferences or a separate settings field)
        // For now, we'll store in gaming_preferences as settings
        const currentPreferences = user.gaming_preferences || {};
        currentPreferences.settings = req.body;
        user.gaming_preferences = currentPreferences;
        await user.save();

        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
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
