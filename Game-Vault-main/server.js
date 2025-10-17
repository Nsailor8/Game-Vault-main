const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Import profile system classes
const { ProfileManager, AdminManager } = require('./profile.js');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve public folder
app.use(express.static(path.join(__dirname, 'public')));

// ===== EJS Setup =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== Initialize Managers =====
const profileManager = new ProfileManager();
const adminManager = new AdminManager();

// ===== Global Middleware for Header =====
app.use((req, res, next) => {
  res.locals.homeLink = '/';
  res.locals.profileLink = '/profile';
  res.locals.friendsLink = '/friends';

  const pathName = req.path;
  if (pathName.startsWith('/profile')) res.locals.activePage = 'profile';
  else if (pathName.startsWith('/friends')) res.locals.activePage = 'friends';
  else if(pathName.startsWith('/wishlist')) res.locals.activePage = 'wishlist';
  else if(pathName.startsWith('/reviews')) res.locals.activePage = 'reviews';
  else if(pathName.startsWith('/admin')) res.locals.activePage = 'admin';
  else res.locals.activePage = 'home';

  next();
});

// ===== Routes =====
app.get('/', (req, res) => {
  res.render('index', { trendingGames: [], recentGames: [] });
});

// ===== Profile Route =====
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

// ===== Friends Route =====
app.get('/friends', (req, res) => {
  res.render('friends');
});

// ===== Wishlist Route =====
app.get('/wishlist', (req, res) => {
  res.render('wishlist');
});

// ===== Reviews Route =====
app.get('/reviews', (req, res) => {
  res.render('reviews');
});
// ===== Admin Route =====
app.get('/admin', (req, res) => {
  res.render('admin');
});

// ===== Error Handling =====
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ===== 404 =====
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => {
  console.log(`🎮 Game Vault running on http://localhost:${PORT}`);
});

module.exports = app;
