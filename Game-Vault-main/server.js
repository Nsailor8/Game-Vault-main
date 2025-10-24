const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
require('dotenv').config();
const GameSearchService = require('./server/services/GameSearchService');
const SteamService = require('./server/services/SteamService');

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
const steamService = new SteamService();

// ===== Passport Configuration =====
app.use(passport.initialize());
app.use(passport.session());

// Steam Strategy Configuration
passport.use(new SteamStrategy({
    returnURL: process.env.STEAM_RETURN_URL || 'http://localhost:3000/api/auth/steam/return',
    realm: process.env.STEAM_REALM || 'http://localhost:3000',
    apiKey: process.env.STEAM_API_KEY || 'your-steam-api-key-here'
}, async (identifier, profile, done) => {
    try {
        // Extract Steam ID from identifier
        const steamId = identifier.split('/').pop();
        
        // Return Steam profile data
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

// User-specific profile routes
app.get('/profile/:username', async (req, res) => {
    const { username } = req.params;
    let profile;

    try {
        console.log('Loading profile for username:', username);
        
        // Load user data from database by username
        const user = await profileManager.getUserByUsername(username);
        
        if (user) {
            console.log('User found in database:', user.username);
            
            // Use statistics from database if available, otherwise calculate from Steam games
            let totalGames = 0;
            let totalPlaytime = 0;
            let achievementCount = 0;
            let avgRating = 0;
            let steamLinked = false;
            
            if (user.steam_id) {
                steamLinked = true;
                console.log('User has Steam account linked:', user.steam_id);
                
                // Use statistics from database if available
                if (user.statistics) {
                    totalGames = user.statistics.totalGamesPlayed || 0;
                    totalPlaytime = user.statistics.totalPlaytime || 0;
                    achievementCount = user.statistics.totalAchievements || 0;
                    avgRating = user.statistics.averageRating || 0;
                    console.log('Statistics loaded from database:', { 
                        totalGames, 
                        totalPlaytime, 
                        achievementCount,
                        avgRating
                    });
                } else if (user.steam_games && user.steam_games.length > 0) {
                    // Fallback: calculate from Steam games if statistics not available
                    totalGames = user.steam_games.length;
                    totalPlaytime = user.steam_games.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
                    achievementCount = user.steam_games.reduce((sum, game) => sum + (game.achievements || 0), 0);
                    totalPlaytime = Math.round(totalPlaytime / 60); // Convert to hours
                    console.log('Statistics calculated from Steam games:', { 
                        totalGames, 
                        totalPlaytime, 
                        achievementCount 
                    });
                } else {
                    console.log('No Steam games found in database for user:', user.username);
                }
            } else {
                console.log('No Steam account linked for user:', user.username);
            }
            
            profile = {
                username: user.username,
                email: user.email,
                joinDate: user.joinDate,
                totalGames: totalGames,
                totalPlaytime: totalPlaytime, // Already in hours from statistics
                avgRating: avgRating, // From statistics or 0 if not available
                achievementCount: achievementCount,
                bio: user.bio || '',
                playStyle: user.gamingPreferences?.playStyle || '',
                favoriteGenres: user.gamingPreferences?.favoriteGenres || [],
                preferredPlatforms: user.gamingPreferences?.preferredPlatforms || [],
                achievements: user.achievements || [],
                steamLinked: steamLinked,
                steam_id: user.steam_id,
                steam_profile: user.steam_profile,
                steam_games: user.steam_games,
                steam_last_sync: user.steam_last_sync,
                isCurrentUser: req.session.user && req.session.user.username === username
            };
        } else {
            console.log('User not found in database, checking session data');
            
            // User not found - check if this is the current user from session
            if (req.session.user && req.session.user.username === username) {
                console.log('Using session data as fallback for user:', username);
                
                // Calculate Steam stats from session if available
                let totalGames = 0;
                let totalPlaytime = 0;
                let achievementCount = 0;
                
                if (req.session.user.steam_games && req.session.user.steam_games.length > 0) {
                    totalGames = req.session.user.steam_games.length;
                    totalPlaytime = req.session.user.steam_games.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
                    achievementCount = req.session.user.steam_games.reduce((sum, game) => sum + (game.achievements || 0), 0);
                }
                
                // Use session data as fallback
                profile = {
                    username: req.session.user.username,
                    email: req.session.user.email || '',
                    joinDate: req.session.user.joinDate || '',
                    totalGames: totalGames,
                    totalPlaytime: Math.round(totalPlaytime / 60),
                    avgRating: 0,
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
                    isCurrentUser: true
                };
            } else {
                console.log('User not found and not current user');
                
                // User not found
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

// Default profile route - redirect to current user's profile
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

// Steam OAuth routes
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
            // Always try to link Steam account to existing account first
            const steamProfileResult = await steamService.getUserProfile(req.user.steamId);
            if (steamProfileResult.success) {
                console.log('Steam profile fetched successfully:', steamProfileResult.profile.personaname);
                
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
                            const linkResult = await steamService.linkSteamAccount(user, req.user.steamId, steamProfileResult.profile);
                            console.log('Steam account linked:', linkResult);
                            
                            // Reload user data from database to get all fields including Steam data
                            const updatedUser = await profileManager.getUserByUsername(req.session.user.username);
                            
                            // Update session with complete user data (preserving all existing data)
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
                        
                        console.log('Session updated with complete user data including Steam info');
                    }
                } else if (req.session.steamLinkUser && req.session.steamLinkUser.username) {
                    // Session user was lost, but we have the Steam link user info
                    console.log('Session user lost, using stored Steam link user:', req.session.steamLinkUser.username);
                    
                    const user = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                    if (user) {
                        // Link Steam account and auto-import games
                        const linkResult = await steamService.linkSteamAccount(user, req.user.steamId, steamProfileResult.profile);
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
                } else {
                    console.log('Session user is undefined, checking stored Steam link user info...');
                    
                    // Check if we have stored Steam link user info first (priority over existing Steam users)
                    if (req.session.steamLinkUser && req.session.steamLinkUser.username) {
                        console.log('Using stored Steam link user info:', req.session.steamLinkUser.username);
                        
                        const user = await profileManager.getUserByUsername(req.session.steamLinkUser.username);
                        if (user) {
                            // Check if user already has Steam linked
                            if (user.steam_id) {
                                console.log('User already has Steam account linked:', user.steam_id);
                                // Just reload the data
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
                                const linkResult = await steamService.linkSteamAccount(user, req.user.steamId, steamProfileResult.profile);
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
                            
                            // Clear the stored Steam link user info
                            delete req.session.steamLinkUser;
                            
                            console.log('Session restored with complete user data including Steam info');
                        }
                    } else {
                        // Fallback: Try to match Steam username with existing user
                        console.log('No stored Steam link user info, trying to match Steam username with existing user...');
                        const steamUsername = steamProfileResult.profile.personaname;
                        console.log('Steam username:', steamUsername);
                        
                        // Try to find user by username that matches Steam username
                        const matchingUser = await profileManager.getUserByUsername(steamUsername);
                        if (matchingUser && !matchingUser.steam_id) {
                            console.log('Found matching user without Steam linked:', matchingUser.username);
                            
                            // Link Steam account to the matching user
                            const linkResult = await steamService.linkSteamAccount(matchingUser, req.user.steamId, steamProfileResult.profile);
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
                        } else {
                            // Check if a user with this Steam ID already exists
                            const existingUser = await profileManager.getUserBySteamId(req.user.steamId);
                            if (existingUser) {
                                console.log('Found existing user with Steam ID:', existingUser.username);
                                
                                // Log in with existing account - reload complete data
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
                                const username = steamProfileResult.profile.personaname || 'Steam User';
                                const email = steamProfileResult.profile.personaname ? `${steamProfileResult.profile.personaname}@steam.local` : 'steam@local.com';
                                
                                // Create user account in database
                                const newUser = await profileManager.createProfile(username, email, 'steam_password', {
                                    playStyle: 'casual',
                                    favoriteGenres: [],
                                    preferredPlatforms: ['PC']
                                });
                                
                                if (newUser) {
                                    // Link Steam account to the new user and auto-import games
                                    const linkResult = await steamService.linkSteamAccount(newUser, req.user.steamId, steamProfileResult.profile);
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
                                } else {
                                    // Fallback to session-only if user creation fails
                                    req.session.user = {
                                        steam_id: req.user.steamId,
                                        steam_profile: steamProfileResult.profile,
                                        username: username,
                                        email: email,
                                        isSteamOnly: true
                                    };
                                }
                            }
                        }
                    }
                }
            } else {
                console.error('Failed to fetch Steam profile:', steamProfileResult.error);
            }
        }
        
        // Check if there's a return URL in the session or redirect to user's profile
        let returnUrl = req.session.returnUrl;
        delete req.session.returnUrl; // Clear it after use
        
        // If no return URL, redirect to user's profile
        if (!returnUrl && req.session.user && req.session.user.username) {
            returnUrl = `/profile/${req.session.user.username}`;
        } else if (!returnUrl) {
            returnUrl = '/profile';
        }
        
        console.log('Redirecting to:', returnUrl);
        
        // Add success parameter to indicate Steam auth completed
        const separator = returnUrl.includes('?') ? '&' : '?';
        res.redirect(`${returnUrl}${separator}steam_auth=success`);
    } catch (error) {
        console.error('Error processing Steam return:', error);
        res.redirect('/profile?error=steam_auth_failed');
    }
});

// Link Steam account to existing user
app.post('/api/auth/steam/link/:username?', async (req, res) => {
    try {
        // Get username from URL parameter or session
        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.status(401).json({ error: 'Username required' });
        }

        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.steam_id) {
            return res.status(400).json({ error: 'Steam account already linked' });
        }

        // Store return URL from request body if provided
        if (req.body.returnUrl) {
            req.session.returnUrl = req.body.returnUrl;
            console.log('Stored return URL:', req.body.returnUrl);
        } else {
            // Default to user's profile page
            req.session.returnUrl = `/profile/${username}`;
            console.log('Using default return URL:', req.session.returnUrl);
        }
        
        // Also store the current user info in session for Steam return
        req.session.steamLinkUser = {
            username: username,
            email: user.email
        };
        console.log('Stored Steam link user info:', req.session.steamLinkUser);

        // Redirect to Steam OAuth
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

// Unlink Steam account
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
            // Remove Steam data from session
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

// Check Steam link status
app.get('/api/auth/steam/status/:username?', async (req, res) => {
    try {
        // Get username from URL parameter or session
        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.json({ linked: false });
        }

        // Try to load user from database first
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
            // Check session data as fallback
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

// Unlink Steam account
app.post('/api/auth/steam/unlink/:username?', async (req, res) => {
    try {
        // Get username from URL parameter or session
        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.status(401).json({ error: 'Username required' });
        }

        const user = await profileManager.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        await steamService.unlinkSteamAccount(user);
        res.json({ success: true, message: 'Steam account unlinked successfully' });
    } catch (error) {
        console.error('Error unlinking Steam account:', error);
        res.status(500).json({ error: 'Failed to unlink Steam account' });
    }
});

// Steam API routes
// Get current user's Steam profile
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

// Get user's Steam game library
app.get('/api/steam/games/:username?', async (req, res) => {
    try {
        // Get username from URL parameter or session
        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.status(401).json({ error: 'Username required' });
        }

        // Try to load user from database first
        let user = await profileManager.getUserByUsername(username);
        
        // If not found in database, check session data
        if (!user && req.session.user && req.session.user.username === username) {
            // Create a temporary user object from session data
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

        // Return cached games if available and recent
        if (user.steam_games && user.steam_last_sync) {
            const hoursSinceSync = (new Date() - new Date(user.steam_last_sync)) / (1000 * 60 * 60);
            if (hoursSinceSync < 24) { // Use cache if less than 24 hours old
                return res.json({
                    success: true,
                    games: user.steam_games,
                    game_count: user.steam_games.length,
                    cached: true,
                    last_sync: user.steam_last_sync
                });
            }
        }

        // Fetch fresh data
        const result = await steamService.getUserGameLibrary(req.session.user.steam_id);
        if (result.success) {
            // Update cache
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

// Import Steam library (sync games to database)
app.post('/api/steam/sync/:username?', async (req, res) => {
    try {
        // Get username from URL parameter or session
        const username = req.params.username || (req.session.user ? req.session.user.username : null);
        
        if (!username) {
            return res.status(401).json({ error: 'Username required' });
        }

        // Load user from database - must be a proper Sequelize model instance
        const user = await profileManager.databaseManager.getUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found in database' });
        }

        if (!user.steam_id) {
            return res.status(400).json({ error: 'No Steam account linked' });
        }

        const syncResult = await steamService.syncUserGames(user);
        if (syncResult.success) {
            // Reload user data from database to get updated statistics
            const updatedUser = await profileManager.databaseManager.getUserByUsername(username);
            
            // Update session if this is the current user
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

// Get achievements for a specific game
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

// Get Steam game details
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

// Get current user's reviews for site ratings
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

// Add game to wishlist with Steam integration
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

        // Add game to default wishlist
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

// Check Steam ownership for wishlisted games
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
        
        // Add Steam ownership information if user is logged in and has Steam linked
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

// Steam API routes
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

        // Return cached games if available and recent
        if (user.steam_games && user.steam_last_sync) {
            const hoursSinceSync = (new Date() - new Date(user.steam_last_sync)) / (1000 * 60 * 60);
            if (hoursSinceSync < 24) { // Use cache if less than 24 hours old
                return res.json({
                    success: true,
                    games: user.steam_games,
                    game_count: user.steam_games.length,
                    cached: true,
                    last_sync: user.steam_last_sync
                });
            }
        }

        // Fetch fresh data
        const result = await steamService.getUserGameLibrary(req.session.user.steam_id);
        if (result.success) {
            // Update cache
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
