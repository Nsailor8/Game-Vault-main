// User Profile Class
class UserProfile {
  constructor(username, email, password, joinDate, gamingPreferences = {}) {
    this.username = username;
    this.email = email;
    this.password = password; // In real app, this would be hashed
    this.joinDate = joinDate;
    this.isActive = true;
    this.lastLogin = null;
    this.gamingPreferences = {
      favoriteGenres: gamingPreferences.favoriteGenres || [],
      preferredPlatforms: gamingPreferences.preferredPlatforms || [],
      playStyle: gamingPreferences.playStyle || 'casual', // casual, hardcore, competitive
      gamingGoals: gamingPreferences.gamingGoals || [],
      ...gamingPreferences
    };
    this.statistics = {
      totalGamesPlayed: 0,
      totalPlaytime: 0,
      averageRating: 0,
      favoriteGame: null,
      mostPlayedPlatform: null,
      completionRate: 0,
      totalReviews: 0,
      friendsCount: 0
    };
    this.achievements = [];
    this.bio = '';
    this.avatar = null;
    this.privacySettings = {
      profileVisibility: 'public', // public, friends, private
      showEmail: false,
      showStatistics: true,
      showFriendsList: true
    };
  }

  authenticate(password) {
    return this.password === password && this.isActive;
  }

  updatePassword(oldPassword, newPassword) {
    if (this.password === oldPassword) {
      this.password = newPassword;
      console.log('Password updated successfully!');
      return true;
    } else {
      console.log('Current password is incorrect.');
      return false;
    }
  }

  updateProfile(updates) {
    Object.keys(updates).forEach(key => {
      if (key === 'gamingPreferences') {
        this.gamingPreferences = { ...this.gamingPreferences, ...updates[key] };
      } else if (key === 'privacySettings') {
        this.privacySettings = { ...this.privacySettings, ...updates[key] };
      } else if (this.hasOwnProperty(key)) {
        this[key] = updates[key];
      }
    });
    console.log('Profile updated successfully!');
  }

  login(password) {
    if (this.authenticate(password)) {
      this.lastLogin = new Date().toISOString();
      console.log(`Welcome back, ${this.username}!`);
      return true;
    } else {
      console.log('Invalid credentials.');
      return false;
    }
  }

  addAchievement(achievement) {
    this.achievements.push({
      ...achievement,
      earnedDate: new Date().toISOString()
    });
    console.log(`Achievement unlocked: ${achievement.name}!`);
  }

  updateStatistics(gameLibrary) {
    const games = gameLibrary.getAllGames();
    this.statistics.totalGamesPlayed = games.length;
    
    // Calculate total playtime (simplified - assumes playtime is in format "X hours")
    this.statistics.totalPlaytime = games.reduce((total, game) => {
      const hours = parseInt(game.playtime) || 0;
      return total + hours;
    }, 0);

    // Calculate average rating
    const ratedGames = games.filter(g => g.rating > 0);
    if (ratedGames.length > 0) {
      this.statistics.averageRating = (ratedGames.reduce((sum, g) => sum + g.rating, 0) / ratedGames.length).toFixed(2);
    }

    // Find favorite game (highest rated)
    const favoriteGame = games.reduce((fav, game) => {
      return (!fav || game.rating > fav.rating) ? game : fav;
    }, null);
    this.statistics.favoriteGame = favoriteGame ? favoriteGame.title : null;

    // Find most played platform
    const platformCounts = games.reduce((acc, game) => {
      acc[game.platform] = (acc[game.platform] || 0) + 1;
      return acc;
    }, {});
    this.statistics.mostPlayedPlatform = Object.keys(platformCounts).reduce((a, b) => 
      platformCounts[a] > platformCounts[b] ? a : b, null);

    // Calculate completion rate
    const completedGames = games.filter(g => g.status === 'completed').length;
    this.statistics.completionRate = games.length > 0 ? 
      ((completedGames / games.length) * 100).toFixed(1) : 0;
  }

  toString() {
    return `
=== USER PROFILE ===
Username: ${this.username}
Email: ${this.email}
Join Date: ${this.joinDate}
Bio: ${this.bio || 'No bio set'}

Gaming Preferences:
- Favorite Genres: ${this.gamingPreferences.favoriteGenres.join(', ') || 'None set'}
- Preferred Platforms: ${this.gamingPreferences.preferredPlatforms.join(', ') || 'None set'}
- Play Style: ${this.gamingPreferences.playStyle}
- Gaming Goals: ${this.gamingPreferences.gamingGoals.join(', ') || 'None set'}

Statistics:
- Total Games Played: ${this.statistics.totalGamesPlayed}
- Total Playtime: ${this.statistics.totalPlaytime} hours
- Average Rating: ${this.statistics.averageRating}/5
- Favorite Game: ${this.statistics.favoriteGame || 'None'}
- Most Played Platform: ${this.statistics.mostPlayedPlatform || 'None'}
- Completion Rate: ${this.statistics.completionRate}%

Achievements: ${this.achievements.length}
${this.achievements.map(a => `- ${a.name}: ${a.description}`).join('\n')}
`;
  }
}

// Friends List Class
class FriendsList {
  constructor(userId) {
    this.userId = userId;
    this.friends = [];
    this.pendingRequests = [];
    this.blockedUsers = [];
  }

  addFriend(friendId, friendUsername) {
    if (this.friends.find(f => f.id === friendId)) {
      console.log(`${friendUsername} is already your friend.`);
      return false;
    }
    
    this.friends.push({
      id: friendId,
      username: friendUsername,
      addedDate: new Date().toISOString(),
      status: 'active'
    });
    console.log(`${friendUsername} added to friends list!`);
    return true;
  }

  removeFriend(friendId) {
    const index = this.friends.findIndex(f => f.id === friendId);
    if (index !== -1) {
      const friend = this.friends.splice(index, 1)[0];
      console.log(`${friend.username} removed from friends list.`);
      return true;
    } else {
      console.log('Friend not found.');
      return false;
    }
  }

  sendFriendRequest(targetUserId, targetUsername) {
    if (this.pendingRequests.find(r => r.targetId === targetUserId)) {
      console.log(`Friend request already sent to ${targetUsername}.`);
      return false;
    }
    
    this.pendingRequests.push({
      targetId: targetUserId,
      targetUsername: targetUsername,
      sentDate: new Date().toISOString(),
      status: 'pending'
    });
    console.log(`Friend request sent to ${targetUsername}!`);
    return true;
  }

  acceptFriendRequest(requestId) {
    const request = this.pendingRequests.find(r => r.id === requestId);
    if (request) {
      this.addFriend(request.targetId, request.targetUsername);
      this.pendingRequests = this.pendingRequests.filter(r => r.id !== requestId);
      return true;
    }
    return false;
  }

  blockUser(userId, username) {
    this.blockedUsers.push({
      id: userId,
      username: username,
      blockedDate: new Date().toISOString()
    });
    // Remove from friends if they were friends
    this.removeFriend(userId);
    console.log(`${username} has been blocked.`);
  }

  getFriendsList() {
    return this.friends.map(friend => ({
      username: friend.username,
      addedDate: friend.addedDate,
      status: friend.status
    }));
  }

  getPendingRequests() {
    return this.pendingRequests;
  }
}

// Wishlist Manager Class
class WishlistManager {
  constructor(userId) {
    this.userId = userId;
    this.wishlists = [];
    this.createWishlist('Main Wishlist', 'My primary wishlist');
  }

  createWishlist(name, description = '') {
    const wishlist = {
      id: this.wishlists.length + 1,
      name: name,
      description: description,
      games: [],
      createdDate: new Date().toISOString(),
      isPublic: false
    };
    this.wishlists.push(wishlist);
    console.log(`Wishlist "${name}" created successfully!`);
    return wishlist;
  }

  addGameToWishlist(wishlistId, game) {
    const wishlist = this.wishlists.find(w => w.id === wishlistId);
    if (wishlist) {
      if (wishlist.games.find(g => g.id === game.id)) {
        console.log('Game already in wishlist.');
        return false;
      }
      wishlist.games.push({
        id: game.id,
        title: game.title,
        platform: game.platform,
        addedDate: new Date().toISOString(),
        priority: 'medium' // low, medium, high
      });
      console.log(`${game.title} added to wishlist "${wishlist.name}"!`);
      return true;
    } else {
      console.log('Wishlist not found.');
      return false;
    }
  }

  removeGameFromWishlist(wishlistId, gameId) {
    const wishlist = this.wishlists.find(w => w.id === wishlistId);
    if (wishlist) {
      const index = wishlist.games.findIndex(g => g.id === gameId);
      if (index !== -1) {
        const game = wishlist.games.splice(index, 1)[0];
        console.log(`${game.title} removed from wishlist "${wishlist.name}".`);
        return true;
      }
    }
    console.log('Game not found in wishlist.');
    return false;
  }

  deleteWishlist(wishlistId) {
    const index = this.wishlists.findIndex(w => w.id === wishlistId);
    if (index !== -1) {
      const wishlist = this.wishlists.splice(index, 1)[0];
      console.log(`Wishlist "${wishlist.name}" deleted.`);
      return true;
    }
    console.log('Wishlist not found.');
    return false;
  }

  getWishlists() {
    return this.wishlists.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      gameCount: w.games.length,
      createdDate: w.createdDate,
      isPublic: w.isPublic
    }));
  }

  getWishlistGames(wishlistId) {
    const wishlist = this.wishlists.find(w => w.id === wishlistId);
    return wishlist ? wishlist.games : [];
  }
}

// Review System Class
class ReviewManager {
  constructor(userId) {
    this.userId = userId;
    this.reviews = [];
  }

  addReview(gameId, gameTitle, rating, reviewText, tags = []) {
    const review = {
      id: this.reviews.length + 1,
      gameId: gameId,
      gameTitle: gameTitle,
      rating: rating, // 1-5 stars
      reviewText: reviewText,
      tags: tags,
      createdDate: new Date().toISOString(),
      helpfulVotes: 0,
      isPublic: true
    };
    this.reviews.push(review);
    console.log(`Review added for ${gameTitle}!`);
    return review;
  }

  updateReview(reviewId, updates) {
    const review = this.reviews.find(r => r.id === reviewId);
    if (review) {
      Object.assign(review, updates);
      review.lastModified = new Date().toISOString();
      console.log('Review updated successfully!');
      return true;
    }
    console.log('Review not found.');
    return false;
  }

  deleteReview(reviewId) {
    const index = this.reviews.findIndex(r => r.id === reviewId);
    if (index !== -1) {
      const review = this.reviews.splice(index, 1)[0];
      console.log(`Review for ${review.gameTitle} deleted.`);
      return true;
    }
    console.log('Review not found.');
    return false;
  }

  getReviews() {
    return this.reviews.map(r => ({
      id: r.id,
      gameTitle: r.gameTitle,
      rating: r.rating,
      reviewText: r.reviewText,
      createdDate: r.createdDate,
      helpfulVotes: r.helpfulVotes
    }));
  }

  getAverageRating() {
    if (this.reviews.length === 0) return 0;
    const totalRating = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    return (totalRating / this.reviews.length).toFixed(2);
  }
}

// Admin Manager Class
class AdminManager {
  constructor() {
    this.admins = [];
    this.systemLogs = [];
  }

  createAdmin(username, email, password) {
    const admin = {
      username: username,
      email: email,
      password: password,
      permissions: ['user_management', 'system_logs'],
      createdDate: new Date().toISOString(),
      isActive: true
    };
    this.admins.push(admin);
    this.logAction('admin_created', `Admin ${username} created`);
    console.log(`Admin ${username} created successfully!`);
    return admin;
  }

  adminLogin(username, password) {
    const admin = this.admins.find(a => a.username === username && a.password === password && a.isActive);
    if (admin) {
      this.logAction('admin_login', `Admin ${username} logged in`);
      console.log(`Admin ${username} logged in successfully!`);
      return admin;
    } else {
      console.log('Invalid admin credentials.');
      return null;
    }
  }

  logAction(action, details) {
    this.systemLogs.push({
      action: action,
      details: details,
      timestamp: new Date().toISOString()
    });
  }

  getSystemLogs() {
    return this.systemLogs;
  }

  getUserStatistics(profileManager) {
    const profiles = profileManager.getAllProfiles();
    return {
      totalUsers: profiles.length,
      activeUsers: profiles.filter(p => p.isActive).length,
      newUsersThisMonth: profiles.filter(p => {
        const joinDate = new Date(p.joinDate);
        const now = new Date();
        return joinDate.getMonth() === now.getMonth() && joinDate.getFullYear() === now.getFullYear();
      }).length
    };
  }
}

// Database Manager Class (Simplified)
class DatabaseManager {
  constructor() {
    this.dataFile = 'data/users.json';
    this.data = {
      users: [],
      games: [],
      reviews: [],
      friendships: [],
      wishlists: []
    };
    this.loadData();
  }

  saveUser(user) {
    const existingIndex = this.data.users.findIndex(u => u.username === user.username);
    if (existingIndex !== -1) {
      this.data.users[existingIndex] = user;
    } else {
      this.data.users.push(user);
    }
    this.saveData();
    console.log(`User ${user.username} saved to database.`);
  }

  loadUser(username) {
    return this.data.users.find(u => u.username === username);
  }

  getAllUsers() {
    return [...this.data.users];
  }

  deleteUser(username) {
    const index = this.data.users.findIndex(u => u.username === username);
    if (index !== -1) {
      this.data.users.splice(index, 1);
      this.saveData();
      console.log(`User ${username} deleted from database.`);
      return true;
    }
    return false;
  }

  exportData() {
    return JSON.stringify(this.data, null, 2);
  }

  importData(jsonData) {
    try {
      this.data = JSON.parse(jsonData);
      console.log('Data imported successfully!');
      return true;
    } catch (error) {
      console.log('Error importing data:', error.message);
      return false;
    }
  }

  // File-based persistence methods (Node.js only)
  loadData() {
    // Only run file operations in Node.js environment
    if (typeof window === 'undefined' && typeof require !== 'undefined') {
      const fs = require('fs');
      const path = require('path');
      
      try {
        // Create data directory if it doesn't exist
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Load data from file if it exists
        if (fs.existsSync(this.dataFile)) {
          const fileData = fs.readFileSync(this.dataFile, 'utf8');
          this.data = JSON.parse(fileData);
          console.log(`Loaded ${this.data.users.length} users from database file.`);
        } else {
          console.log('No existing database file found, starting with empty database.');
        }
      } catch (error) {
        console.log('Error loading data from file:', error.message);
        console.log('Starting with empty database.');
      }
    } else {
      // Browser environment - use localStorage
      const savedData = localStorage.getItem('gameVaultData');
      if (savedData) {
        this.data = JSON.parse(savedData);
        console.log(`Loaded ${this.data.users.length} users from localStorage.`);
      } else {
        console.log('No existing data found, starting with empty database.');
      }
    }
  }

  saveData() {
    // Only run file operations in Node.js environment
    if (typeof window === 'undefined' && typeof require !== 'undefined') {
      const fs = require('fs');
      const path = require('path');
      
      try {
        // Create data directory if it doesn't exist
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Save data to file
        fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
        console.log(`Database saved with ${this.data.users.length} users.`);
      } catch (error) {
        console.log('Error saving data to file:', error.message);
      }
    } else {
      // Browser environment - use localStorage
      localStorage.setItem('gameVaultData', JSON.stringify(this.data));
      console.log(`Data saved with ${this.data.users.length} users.`);
    }
  }
}

// Profile Manager Class
class ProfileManager {
  constructor() {
    this.currentProfile = null;
    this.profiles = [];
    this.friendsLists = new Map();
    this.wishlistManagers = new Map();
    this.reviewManagers = new Map();
    this.databaseManager = new DatabaseManager();
    
    // Load existing users from database
    this.loadExistingUsers();
  }

  loadExistingUsers() {
    const existingUsers = this.databaseManager.getAllUsers();
    existingUsers.forEach(userData => {
      // Recreate UserProfile objects from saved data
      const profile = new UserProfile(
        userData.username,
        userData.email,
        userData.password,
        userData.joinDate,
        userData.gamingPreferences
      );
      
      // Restore additional properties
      profile.bio = userData.bio || '';
      profile.statistics = userData.statistics || profile.statistics;
      profile.achievements = userData.achievements || [];
      profile.isActive = userData.isActive !== undefined ? userData.isActive : true;
      profile.lastLogin = userData.lastLogin || null;
      profile.privacySettings = userData.privacySettings || profile.privacySettings;
      
      this.profiles.push(profile);
      
      // Initialize related managers
      this.friendsLists.set(userData.username, new FriendsList(userData.username));
      this.wishlistManagers.set(userData.username, new WishlistManager(userData.username));
      this.reviewManagers.set(userData.username, new ReviewManager(userData.username));
    });
    
    if (existingUsers.length > 0) {
      console.log(`Loaded ${existingUsers.length} existing users from database.`);
    }
  }

  createProfile(username, email, password, gamingPreferences = {}) {
    const existingProfile = this.profiles.find(p => p.username === username);
    if (existingProfile) {
      console.log(`Profile with username "${username}" already exists!`);
      return false;
    }

    const profile = new UserProfile(username, email, password, new Date().toISOString(), gamingPreferences);
    this.profiles.push(profile);
    this.currentProfile = profile;
    
    // Initialize related managers
    this.friendsLists.set(username, new FriendsList(username));
    this.wishlistManagers.set(username, new WishlistManager(username));
    this.reviewManagers.set(username, new ReviewManager(username));
    
    // Save to database
    this.databaseManager.saveUser(profile);
    
    console.log(`Profile created successfully for ${username}!`);
    return profile;
  }

  signUp(username, email, password, gamingPreferences = {}) {
    return this.createProfile(username, email, password, gamingPreferences);
  }

  login(username, password) {
    const profile = this.profiles.find(p => p.username === username);
    if (profile) {
      if (profile.login(password)) {
        this.currentProfile = profile;
        return profile;
      }
    }
    return null;
  }

  loadProfile(username) {
    const profile = this.profiles.find(p => p.username === username);
    if (profile) {
      this.currentProfile = profile;
      console.log(`Profile loaded: ${username}`);
      return profile;
    } else {
      console.log(`Profile not found: ${username}`);
      return null;
    }
  }

  getCurrentProfile() {
    return this.currentProfile;
  }

  updateCurrentProfile(updates) {
    if (this.currentProfile) {
      this.currentProfile.updateProfile(updates);
      this.databaseManager.saveUser(this.currentProfile);
      return true;
    } else {
      console.log('No profile loaded. Please create or load a profile first.');
      return false;
    }
  }

  addAchievementToCurrentProfile(achievement) {
    if (this.currentProfile) {
      this.currentProfile.addAchievement(achievement);
      return true;
    } else {
      console.log('No profile loaded. Please create or load a profile first.');
      return false;
    }
  }

  updateProfileStatistics(gameLibrary) {
    if (this.currentProfile) {
      this.currentProfile.updateStatistics(gameLibrary);
      console.log('Profile statistics updated!');
      return true;
    } else {
      console.log('No profile loaded. Please create or load a profile first.');
      return false;
    }
  }

  displayCurrentProfile() {
    if (this.currentProfile) {
      console.log(this.currentProfile.toString());
    } else {
      console.log('No profile loaded. Please create or load a profile first.');
    }
  }

  getAllProfiles() {
    return [...this.profiles];
  }

  deleteProfile(username) {
    const index = this.profiles.findIndex(p => p.username === username);
    if (index !== -1) {
      this.profiles.splice(index, 1);
      if (this.currentProfile && this.currentProfile.username === username) {
        this.currentProfile = null;
      }
      // Clean up related data
      this.friendsLists.delete(username);
      this.wishlistManagers.delete(username);
      this.reviewManagers.delete(username);
      this.databaseManager.deleteUser(username);
      console.log(`Profile "${username}" deleted successfully.`);
      return true;
    } else {
      console.log(`Profile "${username}" not found.`);
      return false;
    }
  }

  // Friends management
  getFriendsList() {
    if (this.currentProfile) {
      return this.friendsLists.get(this.currentProfile.username);
    }
    return null;
  }

  // Wishlist management
  getWishlistManager() {
    if (this.currentProfile) {
      return this.wishlistManagers.get(this.currentProfile.username);
    }
    return null;
  }

  // Review management
  getReviewManager() {
    if (this.currentProfile) {
      return this.reviewManagers.get(this.currentProfile.username);
    }
    return null;
  }

  // Import game libraries (placeholder for third-party API integration)
  importGameLibrary(source, credentials) {
    if (this.currentProfile) {
      console.log(`Importing game library from ${source}...`);
      // This would integrate with third-party APIs like Steam, PlayStation, etc.
      console.log('Game library import completed!');
      return true;
    } else {
      console.log('No profile loaded. Please create or load a profile first.');
      return false;
    }
  }
}

// Export classes for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    UserProfile, 
    ProfileManager, 
    FriendsList, 
    WishlistManager, 
    ReviewManager, 
    AdminManager, 
    DatabaseManager 
  };
}

// Example Usage (only runs if this file is executed directly)
if (typeof require !== 'undefined' && require.main === module) {
  console.log('=== COMPREHENSIVE PROFILE SYSTEM DEMO ===');
  
  const profileManager = new ProfileManager();
  const adminManager = new AdminManager();
  
  console.log('\n=== SIGN UP NEW USER ===');
  const gamingPreferences = {
    favoriteGenres: ['RPG', 'Action', 'Indie'],
    preferredPlatforms: ['Steam', 'Nintendo'],
    playStyle: 'hardcore',
    gamingGoals: ['Complete all achievements', 'Try new genres', 'Build a diverse collection']
  };

  profileManager.signUp('GameMaster2024', 'gamemaster@example.com', 'password123', gamingPreferences);

  console.log('\n=== LOGIN WITH EXISTING PROFILE ===');
  profileManager.login('GameMaster2024', 'password123');

  console.log('\n=== UPDATE PROFILE BIO ===');
  profileManager.updateCurrentProfile({
    bio: 'Passionate gamer who loves exploring different worlds and challenging gameplay mechanics. Always looking for the next great adventure!'
  });

  console.log('\n=== ADD ACHIEVEMENTS ===');
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

  console.log('\n=== FRIENDS SYSTEM DEMO ===');
  const friendsList = profileManager.getFriendsList();
  friendsList.sendFriendRequest('user2', 'GamerFriend');
  friendsList.addFriend('user3', 'BestGamer');
  console.log('Friends:', friendsList.getFriendsList());

  console.log('\n=== WISHLIST SYSTEM DEMO ===');
  const wishlistManager = profileManager.getWishlistManager();
  wishlistManager.createWishlist('Must Play Games', 'Games I really want to play');
  wishlistManager.addGameToWishlist(1, { id: 1, title: 'Cyberpunk 2077', platform: 'Steam' });
  wishlistManager.addGameToWishlist(1, { id: 2, title: 'Baldur\'s Gate 3', platform: 'Steam' });
  console.log('Wishlists:', wishlistManager.getWishlists());

  console.log('\n=== REVIEW SYSTEM DEMO ===');
  const reviewManager = profileManager.getReviewManager();
  reviewManager.addReview(1, 'The Witcher 3', 5, 'Amazing RPG with incredible storytelling and world-building!', ['RPG', 'Fantasy', 'Open World']);
  reviewManager.addReview(2, 'Hades', 4, 'Great roguelike with fantastic art and music.', ['Roguelike', 'Action', 'Indie']);
  console.log('Reviews:', reviewManager.getReviews());
  console.log('Average Rating:', reviewManager.getAverageRating());

  console.log('\n=== IMPORT GAME LIBRARY ===');
  profileManager.importGameLibrary('Steam', { apiKey: 'demo_key' });

  console.log('\n=== DISPLAY CURRENT PROFILE ===');
  profileManager.displayCurrentProfile();

  console.log('\n=== ADMIN SYSTEM DEMO ===');
  adminManager.createAdmin('admin', 'admin@example.com', 'admin123');
  adminManager.adminLogin('admin', 'admin123');
  const userStats = adminManager.getUserStatistics(profileManager);
  console.log('User Statistics:', userStats);

  console.log('\n=== DEMONSTRATE MULTIPLE PROFILES ===');
  profileManager.signUp('CasualGamer', 'casual@example.com', 'password456', {
    favoriteGenres: ['Puzzle', 'Platformer'],
    preferredPlatforms: ['Nintendo'],
    playStyle: 'casual',
    gamingGoals: ['Have fun', 'Relax after work']
  });

  console.log('\n=== SWITCH PROFILES ===');
  profileManager.login('CasualGamer', 'password456');
  profileManager.displayCurrentProfile();

  console.log('\n=== SWITCH BACK TO MAIN PROFILE ===');
  profileManager.login('GameMaster2024', 'password123');
  profileManager.displayCurrentProfile();

  console.log('\n=== DATABASE EXPORT ===');
  const exportedData = profileManager.databaseManager.exportData();
  console.log('Database exported successfully!');
}
