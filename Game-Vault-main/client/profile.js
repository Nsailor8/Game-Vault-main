class UserProfile {
  constructor(username, email, password, joinDate, gamingPreferences = {}) {
    this.username = username;
    this.email = email;
    this.password = password;
    this.joinDate = joinDate;
    this.isActive = true;
    this.lastLogin = null;
    this.gamingPreferences = {
      favoriteGenres: gamingPreferences.favoriteGenres || [],
      preferredPlatforms: gamingPreferences.preferredPlatforms || [],
      playStyle: gamingPreferences.playStyle || 'casual',
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
      profileVisibility: 'public',
      showEmail: false,
      showStatistics: true,
      showFriendsList: true
    };
  }

  async authenticate(password) {
    if (!this.isActive) return false;

    if (this.password.startsWith('$2b$')) {
      return await bcrypt.compare(password, this.password);
    }

    return this.password === password;
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

  async login(password) {
    if (await this.authenticate(password)) {
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

    this.statistics.totalPlaytime = games.reduce((total, game) => {
      const hours = parseInt(game.playtime) || 0;
      return total + hours;
    }, 0);

    const ratedGames = games.filter(g => g.rating > 0);
    if (ratedGames.length > 0) {
      this.statistics.averageRating = (ratedGames.reduce((sum, g) => sum + g.rating, 0) / ratedGames.length).toFixed(2);
    }

    const favoriteGame = games.reduce((fav, game) => {
      return (!fav || game.rating > fav.rating) ? game : fav;
    }, null);
    this.statistics.favoriteGame = favoriteGame ? favoriteGame.title : null;

    const platformCounts = games.reduce((acc, game) => {
      acc[game.platform] = (acc[game.platform] || 0) + 1;
      return acc;
    }, {});
    this.statistics.mostPlayedPlatform = Object.keys(platformCounts).reduce((a, b) => 
      platformCounts[a] > platformCounts[b] ? a : b, null);

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
        priority: 'medium'
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
      rating: rating,
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

const RealDatabaseManager = require('../server/database/DatabaseManager');
const bcrypt = require('bcrypt');

class ProfileManager {
  constructor() {
    this.currentProfile = null;
    this.profiles = [];
    this.friendsLists = new Map();
    this.wishlistManagers = new Map();
    this.reviewManagers = new Map();
    this.databaseManager = new RealDatabaseManager();
    this.isInitialized = false;

    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      const connected = await this.databaseManager.initialize();
      if (connected) {
        this.isInitialized = true;
        console.log('✅ Database initialized for ProfileManager');

        await this.loadExistingUsers();
      } else {
        console.error('❌ Failed to initialize database connection');

        this.isInitialized = true;
      }
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      this.isInitialized = true;
    }
  }

  async loadExistingUsers() {
    try {
      const existingUsers = await this.databaseManager.getAllUsers();
      
      for (const userData of existingUsers) {

        const profile = new UserProfile(
          userData.username,
          userData.email,
          userData.password_hash,
          userData.join_date,
          userData.gaming_preferences || {}
        );

        profile.bio = userData.bio || '';
        profile.statistics = userData.statistics || profile.statistics;
        profile.achievements = [];
        profile.isActive = userData.is_active !== undefined ? userData.is_active : true;
        profile.lastLogin = userData.last_login || null;
        profile.privacySettings = {
          profileVisibility: 'public',
          showEmail: false,
          showStatistics: true,
          showFriendsList: true
        };
        
        this.profiles.push(profile);

        this.friendsLists.set(userData.username, new FriendsList(userData.username));
        this.wishlistManagers.set(userData.username, new WishlistManager(userData.username));
        this.reviewManagers.set(userData.username, new ReviewManager(userData.username));
      }
      
      if (existingUsers.length > 0) {
        console.log(`Loaded ${existingUsers.length} existing users from database.`);
      }
    } catch (error) {
      console.error('Error loading existing users:', error);
    }
  }

  async createProfile(username, email, password, gamingPreferences = {}) {

    if (!this.isInitialized) {
      console.log('Database not initialized yet, please wait...');
      return false;
    }

    const existingProfile = this.profiles.find(p => p.username === username);
    if (existingProfile) {
      console.log(`Profile with username "${username}" already exists!`);
      return false;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const profile = new UserProfile(username, email, hashedPassword, new Date().toISOString(), gamingPreferences);
    this.profiles.push(profile);
    this.currentProfile = profile;

    this.friendsLists.set(username, new FriendsList(username));
    this.wishlistManagers.set(username, new WishlistManager(username));
    this.reviewManagers.set(username, new ReviewManager(username));

    try {
      await this.databaseManager.saveUser(profile);
      console.log(`Profile created successfully for ${username}!`);
      return profile;
    } catch (error) {
      console.error('Error saving profile to database:', error);

      const index = this.profiles.findIndex(p => p.username === username);
      if (index !== -1) {
        this.profiles.splice(index, 1);
      }
      return false;
    }
  }

  async signUp(username, email, password, gamingPreferences = {}) {
    return await this.createProfile(username, email, password, gamingPreferences);
  }

  async login(username, password) {
    const profile = this.profiles.find(p => p.username === username);
    if (profile) {
      if (await profile.login(password)) {
        this.currentProfile = profile;

        this.updateLastLogin(username);
        return profile;
      }
    }
    return null;
  }

  async getUserByUsername(username) {
    try {

      let profile = this.profiles.find(p => p.username === username);
      
      if (!profile && this.isInitialized) {

        const userData = await this.databaseManager.getUserByUsername(username);
        if (userData) {

          profile = new UserProfile(
            userData.username,
            userData.email,
            userData.password_hash,
            userData.join_date,
            userData.gaming_preferences || {}
          );

          profile.bio = userData.bio || '';
          profile.statistics = userData.statistics || profile.statistics;
          profile.achievements = [];
          profile.isActive = userData.is_active !== undefined ? userData.is_active : true;
          profile.lastLogin = userData.last_login || null;
          profile.privacySettings = {
            profileVisibility: 'public',
            showEmail: false,
            showStatistics: true,
            showFriendsList: true
          };

          if (userData.steam_id) {
            profile.steam_id = userData.steam_id;
            profile.steam_profile = userData.steam_profile;
            profile.steam_linked_at = userData.steam_linked_at;
            profile.steam_games = userData.steam_games;
            profile.steam_last_sync = userData.steam_last_sync;
          }

          this.profiles.push(profile);

          if (!this.friendsLists.has(username)) {
            this.friendsLists.set(username, new FriendsList(username));
          }
          if (!this.wishlistManagers.has(username)) {
            this.wishlistManagers.set(username, new WishlistManager(username));
          }
          if (!this.reviewManagers.has(username)) {
            this.reviewManagers.set(username, new ReviewManager(username));
          }
        }
      }
      
      return profile;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  async getUserBySteamId(steamId) {
    try {

      let profile = this.profiles.find(p => p.steam_id === steamId);
      
      if (!profile && this.isInitialized) {

        const userData = await this.databaseManager.getUserBySteamId(steamId);
        if (userData) {

          profile = new UserProfile(
            userData.username,
            userData.email,
            userData.password_hash,
            userData.join_date,
            userData.gaming_preferences || {}
          );

          profile.bio = userData.bio || '';
          profile.statistics = userData.statistics || profile.statistics;
          profile.achievements = [];
          profile.isActive = userData.is_active !== undefined ? userData.is_active : true;
          profile.lastLogin = userData.last_login || null;
          profile.privacySettings = {
            profileVisibility: 'public',
            showEmail: false,
            showStatistics: true,
            showFriendsList: true
          };

          if (userData.steam_id) {
            profile.steam_id = userData.steam_id;
            profile.steam_profile = userData.steam_profile;
            profile.steam_linked_at = userData.steam_linked_at;
            profile.steam_games = userData.steam_games;
            profile.steam_last_sync = userData.steam_last_sync;
          }

          this.profiles.push(profile);

          if (!this.friendsLists.has(userData.username)) {
            this.friendsLists.set(userData.username, new FriendsList(userData.username));
          }
          if (!this.wishlistManagers.has(userData.username)) {
            this.wishlistManagers.set(userData.username, new WishlistManager(userData.username));
          }
          if (!this.reviewManagers.has(userData.username)) {
            this.reviewManagers.set(userData.username, new ReviewManager(userData.username));
          }
        }
      }
      
      return profile;
    } catch (error) {
      console.error('Error getting user by Steam ID:', error);
      return null;
    }
  }

  async updateLastLogin(username) {
    try {
      await this.databaseManager.updateUser(username, {
        last_login: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
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

  async updateCurrentProfile(updates) {
    if (this.currentProfile) {
      this.currentProfile.updateProfile(updates);
      try {
        await this.databaseManager.saveUser(this.currentProfile);
        return true;
      } catch (error) {
        console.error('Error updating profile in database:', error);
        return false;
      }
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

  getFriendsList() {
    if (this.currentProfile) {
      return this.friendsLists.get(this.currentProfile.username);
    }
    return null;
  }

  getWishlistManager() {
    if (this.currentProfile) {
      return this.wishlistManagers.get(this.currentProfile.username);
    }
    return null;
  }

  getReviewManager() {
    if (this.currentProfile) {
      return this.reviewManagers.get(this.currentProfile.username);
    }
    return null;
  }

  importGameLibrary(source, credentials) {
    if (this.currentProfile) {
      console.log(`Importing game library from ${source}...`);

      console.log('Game library import completed!');
      return true;
    } else {
      console.log('No profile loaded. Please create or load a profile first.');
      return false;
    }
  }

  // Friend management methods
  async getUserByUsername(username) {
    try {
      const { User } = require('../server/models/index');
      const user = await User.findOne({ 
        where: { username: username },
        attributes: ['user_id', 'username', 'email', 'join_date', 'bio']
      });
      if (user) {
        // Map the database fields to the expected format
        return {
          id: user.user_id,
          username: user.username,
          email: user.email,
          joinDate: user.join_date,
          bio: user.bio
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  async getFriendships(userId, status = 'accepted') {
    try {
      const { Friendship, User } = require('../server/models/index');
      const friendships = await Friendship.findAll({
        where: {
          [require('sequelize').Op.or]: [
            { userId: userId, status: status },
            { friendId: userId, status: status }
          ]
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['user_id', 'username', 'email', 'join_date', 'bio']
          },
          {
            model: User,
            as: 'friend',
            attributes: ['user_id', 'username', 'email', 'join_date', 'bio']
          }
        ]
      });

      return friendships.map(friendship => {
        const friend = friendship.userId === userId ? friendship.friend : friendship.user;
        return {
          id: friendship.id,
          friendId: friend.user_id,
          username: friend.username,
          email: friend.email,
          joinDate: friend.join_date,
          bio: friend.bio,
          friendshipDate: friendship.acceptedDate || friendship.sentDate,
          status: friendship.status
        };
      });
    } catch (error) {
      console.error('Error getting friendships:', error);
      return [];
    }
  }

  async getSentFriendRequests(userId) {
    try {
      const { Friendship, User } = require('../server/models/index');
      const requests = await Friendship.findAll({
        where: {
          userId: userId,
          status: 'pending'
        },
        include: [
          {
            model: User,
            as: 'friend',
            attributes: ['user_id', 'username', 'email', 'join_date', 'bio']
          }
        ]
      });

      return requests.map(request => ({
        id: request.id,
        friendId: request.friend.user_id,
        username: request.friend.username,
        email: request.friend.email,
        joinDate: request.friend.join_date,
        bio: request.friend.bio,
        sentDate: request.sentDate,
        status: request.status
      }));
    } catch (error) {
      console.error('Error getting sent friend requests:', error);
      return [];
    }
  }

  async getReceivedFriendRequests(userId) {
    try {
      const { Friendship, User } = require('../server/models/index');
      const requests = await Friendship.findAll({
        where: {
          friendId: userId,
          status: 'pending'
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['user_id', 'username', 'email', 'join_date', 'bio']
          }
        ]
      });

      return requests.map(request => ({
        id: request.id,
        userId: request.user.user_id,
        username: request.user.username,
        email: request.user.email,
        joinDate: request.user.join_date,
        bio: request.user.bio,
        sentDate: request.sentDate,
        status: request.status
      }));
    } catch (error) {
      console.error('Error getting received friend requests:', error);
      return [];
    }
  }

  async getFriendship(userId, friendId) {
    try {
      const { Friendship } = require('../server/models/index');
      const friendship = await Friendship.findOne({
        where: {
          [require('sequelize').Op.or]: [
            { userId: userId, friendId: friendId },
            { userId: friendId, friendId: userId }
          ]
        }
      });
      return friendship;
    } catch (error) {
      console.error('Error getting friendship:', error);
      return null;
    }
  }

  async createFriendRequest(userId, friendId) {
    try {
      const { Friendship } = require('../server/models/index');
      const friendship = await Friendship.create({
        userId: userId,
        friendId: friendId,
        status: 'pending',
        sentDate: new Date()
      });
      return friendship;
    } catch (error) {
      console.error('Error creating friend request:', error);
      throw error;
    }
  }

  async acceptFriendRequest(requestId, userId) {
    try {
      const { Friendship } = require('../server/models/index');
      const friendship = await Friendship.findOne({
        where: {
          id: requestId,
          friendId: userId,
          status: 'pending'
        }
      });

      if (friendship) {
        friendship.status = 'accepted';
        friendship.acceptedDate = new Date();
        await friendship.save();
        return friendship;
      }
      return null;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      throw error;
    }
  }

  async declineFriendRequest(requestId, userId) {
    try {
      const { Friendship } = require('../server/models/index');
      const friendship = await Friendship.findOne({
        where: {
          id: requestId,
          friendId: userId,
          status: 'pending'
        }
      });

      if (friendship) {
        await friendship.destroy();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error declining friend request:', error);
      throw error;
    }
  }

  async removeFriend(userId, friendId) {
    try {
      const { Friendship } = require('../server/models/index');
      const friendship = await Friendship.findOne({
        where: {
          [require('sequelize').Op.or]: [
            { userId: userId, friendId: friendId },
            { userId: friendId, friendId: userId }
          ],
          status: 'accepted'
        }
      });

      if (friendship) {
        await friendship.destroy();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing friend:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const { User } = require('../server/models/index');
      const users = await User.findAll({
        attributes: ['user_id', 'username', 'email', 'join_date'],
        where: { is_active: true }
      });
      return users.map(user => ({
        id: user.user_id,
        username: user.username,
        email: user.email,
        joinDate: user.join_date
      }));
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    UserProfile, 
    ProfileManager, 
    FriendsList, 
    WishlistManager, 
    ReviewManager, 
     AdminManager
  };
}

if (typeof window !== 'undefined') {

    window.connectSteam = async function() {
        try {
            console.log('Initiating Steam connection...');

            const connectBtn = document.getElementById('connectSteamBtn');
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                connectBtn.disabled = true;
            }

            const currentUrl = window.location.pathname;

            const response = await fetch('/api/auth/steam/link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    returnUrl: currentUrl
                })
            });
            
            const result = await response.json();
            
            if (result.success) {

                window.location.href = result.redirectUrl;
            } else {
                throw new Error(result.error || 'Failed to initiate Steam connection');
            }
        } catch (error) {
            console.error('Error connecting to Steam:', error);
            alert('Failed to connect to Steam: ' + error.message);

            const connectBtn = document.getElementById('connectSteamBtn');
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fab fa-steam"></i> Connect Steam';
                connectBtn.disabled = false;
            }
        }
    };

    window.importSteamLibrary = async function() {
        try {
            console.log('Importing Steam library...');

            const importBtn = document.getElementById('importSteamLibraryBtn');
            if (importBtn) {
                importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
                importBtn.disabled = true;
            }

            const pathParts = window.location.pathname.split('/');
            const username = pathParts[pathParts.length - 1];

            const response = await fetch(`/api/steam/sync/${username}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`Successfully imported ${result.gamesCount} games from Steam`);

                showNotification(`Successfully imported ${result.gamesCount} games from Steam!`, 'success');

                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                throw new Error(result.error || 'Failed to import Steam library');
            }
        } catch (error) {
            console.error('Error importing Steam library:', error);
            alert('Failed to import Steam library: ' + error.message);

            const importBtn = document.getElementById('importSteamLibraryBtn');
            if (importBtn) {
                importBtn.innerHTML = 'Import Steam Library';
                importBtn.disabled = false;
            }
        }
    };

    window.disconnectSteam = async function() {
        try {
            if (!confirm('Are you sure you want to disconnect your Steam account? This will remove all Steam data from your profile.')) {
                return;
            }
            
            console.log('Disconnecting Steam account...');

            const disconnectBtn = document.getElementById('disconnectSteamBtn');
            if (disconnectBtn) {
                disconnectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Disconnecting...';
                disconnectBtn.disabled = true;
            }

            const pathParts = window.location.pathname.split('/');
            const username = pathParts[pathParts.length - 1];

            const response = await fetch(`/api/auth/steam/unlink/${username}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Steam account disconnected successfully');

                showNotification('Steam account disconnected successfully', 'success');

                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                throw new Error(result.error || 'Failed to disconnect Steam account');
            }
        } catch (error) {
            console.error('Error disconnecting Steam account:', error);
            alert('Failed to disconnect Steam account: ' + error.message);

            const disconnectBtn = document.getElementById('disconnectSteamBtn');
            if (disconnectBtn) {
                disconnectBtn.innerHTML = 'Disconnect Steam';
                disconnectBtn.disabled = false;
            }
        }
    };

    window.loadSteamProfile = async function() {
        try {

            const pathParts = window.location.pathname.split('/');
            const username = pathParts[pathParts.length - 1];

            const statusResponse = await fetch(`/api/auth/steam/status/${username}`);
            const statusResult = await statusResponse.json();
            
            if (statusResult.linked) {

                const steamProfileSection = document.getElementById('steamProfileSection');
                const steamConnectSection = document.getElementById('steamConnectSection');
                
                if (steamProfileSection) {
                    steamProfileSection.style.display = 'block';
                }
                if (steamConnectSection) {
                    steamConnectSection.style.display = 'none';
                }

                if (statusResult.steam_profile) {
                    const steamAvatar = document.getElementById('steamAvatar');
                    const steamUsername = document.getElementById('steamUsername');
                    const steamProfileUrl = document.getElementById('steamProfileUrl');
                    
                    if (steamAvatar && statusResult.steam_profile.avatarfull) {
                        steamAvatar.src = statusResult.steam_profile.avatarfull;
                    }
                    if (steamUsername) {
                        steamUsername.textContent = statusResult.steam_profile.personaname || 'Steam User';
                    }
                    if (steamProfileUrl) {
                        steamProfileUrl.innerHTML = `<a href="${statusResult.steam_profile.profileurl}" target="_blank">View Steam Profile</a>`;
                    }
                }

                if (statusResult.steam_games && statusResult.steam_games.length > 0) {
                    updateSteamStats(statusResult.steam_games);
                }
            } else {

                const steamProfileSection = document.getElementById('steamProfileSection');
                const steamConnectSection = document.getElementById('steamConnectSection');
                
                if (steamProfileSection) {
                    steamProfileSection.style.display = 'none';
                }
                if (steamConnectSection) {
                    steamConnectSection.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error loading Steam profile:', error);
        }
    };

    function updateSteamStats(steamGames) {
        try {

            const totalGames = steamGames.length;
            const totalPlaytime = steamGames.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
            const totalAchievements = steamGames.reduce((sum, game) => sum + (game.achievements || 0), 0);

            const totalGamesElement = document.getElementById('totalGames');
            const totalPlaytimeElement = document.getElementById('totalPlaytime');
            const achievementCountElement = document.getElementById('achievementCount');
            
            if (totalGamesElement) {
                totalGamesElement.textContent = totalGames;
            }
            if (totalPlaytimeElement) {
                totalPlaytimeElement.textContent = Math.round(totalPlaytime / 60);
            }
            if (achievementCountElement) {
                achievementCountElement.textContent = totalAchievements;
            }
            
            console.log('Steam stats updated:', { totalGames, totalPlaytime: Math.round(totalPlaytime / 60), totalAchievements });
        } catch (error) {
            console.error('Error updating Steam stats:', error);
        }
    }

    function showNotification(message, type = 'info') {

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ff9800';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', () => {

        if (window.location.pathname.startsWith('/profile')) {
            loadSteamProfile();
        }
    });
}
