const { 
  User, 
  Game, 
  Review, 
  Wishlist, 
  WishlistGame, 
  Friendship, 
  Achievement,
  sequelize 
} = require('../models/index');

class DatabaseManager {
  constructor() {
    this.isConnected = false;
  }

  async initialize() {
    try {
      await sequelize.authenticate();
      this.isConnected = true;
      console.log('✅ Database connection established successfully.');
      return true;
    } catch (error) {
      console.error('❌ Unable to connect to the database:', error);
      return false;
    }
  }

  async syncDatabase(force = false) {
    try {
      await sequelize.sync({ force });
      console.log('✅ Database synchronized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error synchronizing database:', error);
      return false;
    }
  }

  // User operations
  async saveUser(userData) {
    try {
      // Build the data object, only including password_hash if it's provided
      const userDataToSave = {
        username: userData.username,
        email: userData.email,
        join_date: userData.joinDate || userData.join_date,
        is_active: userData.isActive !== undefined ? userData.isActive : userData.is_active,
        last_login: userData.lastLogin || userData.last_login,
        bio: userData.bio,
        gaming_preferences: userData.gamingPreferences || userData.gaming_preferences,
        statistics: userData.statistics,
        steam_id: userData.steam_id,
        steam_profile: userData.steam_profile,
        steam_linked_at: userData.steam_linked_at,
        steam_games: userData.steam_games,
        steam_last_sync: userData.steam_last_sync
      };

      // Only include password_hash if it's provided and not null/undefined
      if (userData.password_hash !== undefined && userData.password_hash !== null) {
        userDataToSave.password_hash = userData.password_hash;
      } else if (userData.password !== undefined && userData.password !== null) {
        userDataToSave.password_hash = userData.password;
      }

      const [user, created] = await User.upsert(userDataToSave);
      
      console.log(`${created ? 'Created' : 'Updated'} user ${userData.username} in database.`);
      
      // If this is a new user, create default libraries
      if (created && user.id) {
        try {
          await this.createDefaultLibraries(user.id);
        } catch (error) {
          console.error('Error creating default libraries for new user:', error);
          // Don't throw - libraries can be created later
        }
      }
      
      return user;
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  async loadUser(username) {
    try {
      const user = await User.findOne({ where: { username } });
      return user;
    } catch (error) {
      console.error('Error loading user:', error);
      return null;
    }
  }

  async getUserByUsername(username) {
    try {
      const user = await User.findOne({ where: { username } });
      return user;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  async getUserBySteamId(steamId) {
    try {
      const user = await User.findOne({ where: { steam_id: steamId } });
      return user;
    } catch (error) {
      console.error('Error getting user by Steam ID:', error);
      return null;
    }
  }

  async getAllUsers() {
    try {
      const users = await User.findAll({
        where: { is_active: true },
        order: [['join_date', 'DESC']]
      });
      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  async deleteUser(username) {
    try {
      const result = await User.destroy({ where: { username } });
      if (result > 0) {
        console.log(`User ${username} deleted from database.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async updateUser(username, updates) {
    try {
      const [updatedRowsCount] = await User.update(updates, { 
        where: { username } 
      });
      if (updatedRowsCount > 0) {
        console.log(`User ${username} updated in database.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  }

  // Admin operations
  async createAdmin(username, email, password) {
    try {
      const bcrypt = require('bcrypt');
      const password_hash = await bcrypt.hash(password, 10);
      
      const [user, created] = await User.upsert({
        username: username,
        email: email,
        password_hash: password_hash,
        is_admin: true,
        is_active: true,
        join_date: new Date()
      });
      
      if (created) {
        console.log(`Admin ${username} created in database.`);
      } else {
        // Update existing user to be admin
        await User.update({ is_admin: true }, { where: { username } });
        console.log(`User ${username} promoted to admin in database.`);
      }
      
      return user;
    } catch (error) {
      console.error('Error creating admin:', error);
      throw error;
    }
  }

  async getAdmins() {
    try {
      const admins = await User.findAll({
        where: { is_admin: true, is_active: true },
        attributes: ['user_id', 'username', 'email', 'join_date', 'is_admin'],
        order: [['join_date', 'DESC']]
      });
      return admins;
    } catch (error) {
      console.error('Error getting admins:', error);
      return [];
    }
  }

  async isAdmin(username) {
    try {
      const user = await User.findOne({
        where: { username, is_admin: true, is_active: true }
      });
      return user !== null;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  async promoteToAdmin(username) {
    try {
      const [updatedRowsCount] = await User.update(
        { is_admin: true },
        { where: { username, is_active: true } }
      );
      if (updatedRowsCount > 0) {
        console.log(`User ${username} promoted to admin.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      return false;
    }
  }

  async demoteFromAdmin(username) {
    try {
      const [updatedRowsCount] = await User.update(
        { is_admin: false },
        { where: { username } }
      );
      if (updatedRowsCount > 0) {
        console.log(`User ${username} demoted from admin.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error demoting user from admin:', error);
      return false;
    }
  }

  // Game operations
  async saveGame(gameData) {
    try {
      const [game, created] = await Game.upsert({
        title: gameData.title,
        platform: gameData.platform,
        genre: gameData.genre,
        releaseDate: gameData.releaseDate,
        description: gameData.description,
        imageUrl: gameData.imageUrl,
        steamId: gameData.steamId,
        metacriticScore: gameData.metacriticScore,
        price: gameData.price,
        isActive: gameData.isActive
      });
      
      console.log(`${created ? 'Created' : 'Updated'} game ${gameData.title} in database.`);
      return game;
    } catch (error) {
      console.error('Error saving game:', error);
      throw error;
    }
  }

  async getGameById(id) {
    try {
      return await Game.findByPk(id);
    } catch (error) {
      console.error('Error getting game by ID:', error);
      return null;
    }
  }

  async searchGames(searchTerm) {
    try {
      return await Game.findAll({
        where: {
          [sequelize.Op.or]: [
            { title: { [sequelize.Op.iLike]: `%${searchTerm}%` } },
            { genre: { [sequelize.Op.iLike]: `%${searchTerm}%` } },
            { platform: { [sequelize.Op.iLike]: `%${searchTerm}%` } }
          ],
          isActive: true
        },
        order: [['title', 'ASC']]
      });
    } catch (error) {
      console.error('Error searching games:', error);
      return [];
    }
  }

  // Review operations
  async saveReview(reviewData) {
    try {
      const review = await Review.create({
        userId: reviewData.userId,
        gameId: reviewData.gameId,
        gameTitle: reviewData.gameTitle,
        rating: reviewData.rating,
        reviewText: reviewData.reviewText,
        tags: reviewData.tags,
        helpfulVotes: reviewData.helpfulVotes,
        isPublic: reviewData.isPublic
      });
      
      console.log(`Review saved for ${reviewData.gameTitle}`);
      return review;
    } catch (error) {
      console.error('Error saving review:', error);
      throw error;
    }
  }

  async getUserReviews(userId) {
    try {
      return await Review.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      console.error('Error getting user reviews:', error);
      return [];
    }
  }

  async getGameReviews(gameId) {
    try {
      return await Review.findAll({
        where: { gameId },
        include: [{ model: User, as: 'user', attributes: ['username', 'avatar'] }],
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      console.error('Error getting game reviews:', error);
      return [];
    }
  }

  // Library/Wishlist operations
  async createWishlist(wishlistData) {
    try {
      const wishlist = await Wishlist.create({
        userId: wishlistData.userId,
        name: wishlistData.name,
        description: wishlistData.description || '',
        isPublic: wishlistData.isPublic || false,
        priority: wishlistData.priority || 'medium',
        type: wishlistData.type || 'custom'
      });
      
      console.log(`Library "${wishlistData.name}" created (type: ${wishlistData.type || 'custom'})`);
      return wishlist;
    } catch (error) {
      console.error('Error creating library:', error);
      throw error;
    }
  }

  async createDefaultLibraries(userId) {
    try {
      // Check if default libraries already exist
      const existingAutomatic = await Wishlist.findOne({
        where: { userId, type: 'automatic' }
      });
      const existingWishlist = await Wishlist.findOne({
        where: { userId, type: 'wishlist' }
      });

      const created = [];

      if (!existingAutomatic) {
        const automatic = await this.createWishlist({
          userId,
          name: 'My Library',
          description: 'Your personal game library',
          type: 'automatic',
          isPublic: false,
          priority: 'medium'
        });
        created.push(automatic);
      }

      if (!existingWishlist) {
        const wishlist = await this.createWishlist({
          userId,
          name: 'Wishlist',
          description: 'Games you want to play',
          type: 'wishlist',
          isPublic: false,
          priority: 'medium'
        });
        created.push(wishlist);
      }

      if (created.length > 0) {
        console.log(`Created ${created.length} default library/libraries for user ${userId}`);
      }
      return created;
    } catch (error) {
      console.error('Error creating default libraries:', error);
      throw error;
    }
  }

  async updateLibrary(libraryId, updates) {
    try {
      const [updatedRowsCount] = await Wishlist.update(updates, {
        where: { id: libraryId }
      });
      if (updatedRowsCount > 0) {
        console.log(`Library ${libraryId} updated`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating library:', error);
      throw error;
    }
  }

  async deleteLibrary(libraryId) {
    try {
      // First delete all games in the library
      await WishlistGame.destroy({ where: { wishlistId: libraryId } });
      // Then delete the library
      const result = await Wishlist.destroy({ where: { id: libraryId } });
      if (result > 0) {
        console.log(`Library ${libraryId} deleted`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting library:', error);
      throw error;
    }
  }

  async getLibraryByType(userId, type) {
    try {
      return await Wishlist.findOne({
        where: { userId, type }
      });
    } catch (error) {
      console.error('Error getting library by type:', error);
      return null;
    }
  }

  async getUserWishlists(userId) {
    try {
      return await Wishlist.findAll({
        where: { userId },
        order: [
          // Sort by type first: automatic, wishlist, then custom
          [sequelize.literal("CASE WHEN type = 'automatic' THEN 0 WHEN type = 'wishlist' THEN 1 ELSE 2 END"), 'ASC'],
          ['createdAt', 'ASC']
        ]
      });
    } catch (error) {
      console.error('Error getting user libraries:', error);
      return [];
    }
  }

  async addGameToWishlist(wishlistId, gameData) {
    try {
      // Check if game exists in local games table
      let localGameId = null;
      if (gameData.gameId) {
        const localGame = await Game.findByPk(gameData.gameId);
        if (localGame) {
          localGameId = gameData.gameId;
        }
      }
      
      // If gameId looks like a Steam ID (large number) and game doesn't exist locally,
      // treat it as a Steam ID
      const steamId = (!localGameId && gameData.gameId && gameData.gameId > 10000) 
        ? gameData.gameId 
        : gameData.steamId || null;
      
      const wishlistGame = await WishlistGame.create({
        wishlistId: wishlistId,
        gameId: localGameId,  // Can be null if game doesn't exist locally
        steamId: steamId,  // Store Steam ID separately
        gameTitle: gameData.title,
        platform: gameData.platform,
        priority: gameData.priority,
        notes: gameData.notes
      });
      
      console.log(`Game ${gameData.title} added to library (gameId: ${localGameId || 'N/A'}, steamId: ${steamId || 'N/A'})`);
      return wishlistGame;
    } catch (error) {
      console.error('Error adding game to library:', error);
      throw error;
    }
  }

  async getWishlistGames(wishlistId) {
    try {
      return await WishlistGame.findAll({
        where: { wishlistId },
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      console.error('Error getting wishlist games:', error);
      return [];
    }
  }

  // Friendship operations
  async createFriendship(friendshipData) {
    try {
      const friendship = await Friendship.create({
        userId: friendshipData.userId,
        friendId: friendshipData.friendId,
        status: friendshipData.status,
        sentDate: friendshipData.sentDate,
        acceptedDate: friendshipData.acceptedDate
      });
      
      console.log(`Friendship created between users ${friendshipData.userId} and ${friendshipData.friendId}`);
      return friendship;
    } catch (error) {
      console.error('Error creating friendship:', error);
      throw error;
    }
  }

  async getUserFriends(userId) {
    try {
      const friendships = await Friendship.findAll({
        where: {
          [sequelize.Op.or]: [
            { userId: userId, status: 'accepted' },
            { friendId: userId, status: 'accepted' }
          ]
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'avatar'],
            where: { id: { [sequelize.Op.ne]: userId } }
          },
          {
            model: User,
            as: 'friend',
            attributes: ['id', 'username', 'avatar'],
            where: { id: { [sequelize.Op.ne]: userId } }
          }
        ]
      });
      
      return friendships;
    } catch (error) {
      console.error('Error getting user friends:', error);
      return [];
    }
  }

  // Achievement operations
  async saveAchievement(achievementData) {
    try {
      const achievement = await Achievement.create({
        userId: achievementData.userId,
        name: achievementData.name,
        description: achievementData.description,
        rarity: achievementData.rarity,
        iconUrl: achievementData.iconUrl,
        earnedDate: achievementData.earnedDate
      });
      
      console.log(`Achievement "${achievementData.name}" saved`);
      return achievement;
    } catch (error) {
      console.error('Error saving achievement:', error);
      throw error;
    }
  }

  async getUserAchievements(userId) {
    try {
      return await Achievement.findAll({
        where: { userId },
        order: [['earnedDate', 'DESC']]
      });
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return [];
    }
  }

  // Statistics
  async getUserStatistics() {
    try {
      const totalUsers = await User.count({ where: { is_active: true } });
      const totalGames = await Game.count();
      const totalReviews = await Review.count();
      const totalWishlists = await Wishlist.count();
      
      return {
        totalUsers,
        totalGames,
        totalReviews,
        totalWishlists,
        averageReviewsPerUser: totalUsers > 0 ? (totalReviews / totalUsers).toFixed(2) : 0
      };
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return {
        totalUsers: 0,
        totalGames: 0,
        totalReviews: 0,
        totalWishlists: 0,
        averageReviewsPerUser: 0
      };
    }
  }

  // Close connection
  async close() {
    try {
      await sequelize.close();
      this.isConnected = false;
      console.log('Database connection closed.');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

module.exports = DatabaseManager;
