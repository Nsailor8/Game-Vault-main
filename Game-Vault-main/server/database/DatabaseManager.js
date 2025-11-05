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
      
      // Run migrations to add missing columns
      await this.runMigrations();
      
      return true;
    } catch (error) {
      console.error('❌ Unable to connect to the database:', error);
      return false;
    }
  }

  async runMigrations() {
    try {
      // Check if 'type' column exists in wishlists table
      const [results] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'wishlists' AND column_name = 'type';
      `);
      
      if (results.length === 0) {
        console.log('🔄 Adding "type" column to wishlists table...');
        
        try {
          // First, create the ENUM type if it doesn't exist
          await sequelize.query(`
            DO $$ BEGIN
              CREATE TYPE "enum_wishlists_type" AS ENUM ('automatic', 'wishlist', 'custom');
            EXCEPTION
              WHEN duplicate_object THEN null;
            END $$;
          `);
          
          // Add the column with the ENUM type
          await sequelize.query(`
            ALTER TABLE wishlists 
            ADD COLUMN type "enum_wishlists_type" DEFAULT 'custom' NOT NULL;
          `);
          
          console.log('✅ Successfully added "type" column to wishlists table');
        } catch (migrationError) {
          console.error('❌ Error adding "type" column:', migrationError.message);
          // Try alternative approach with VARCHAR if ENUM fails
          try {
            await sequelize.query(`
              ALTER TABLE wishlists 
              ADD COLUMN type VARCHAR(20) DEFAULT 'custom' NOT NULL;
            `);
            console.log('✅ Successfully added "type" column as VARCHAR');
          } catch (altError) {
            console.error('❌ Alternative migration also failed:', altError.message);
            throw altError;
          }
        }
      } else {
        console.log('✅ "type" column already exists in wishlists table');
      }

      // Check if 'steam_id' column exists in wishlist_games table
      const [steamIdResults] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'wishlist_games' AND column_name = 'steam_id';
      `);
      
      if (steamIdResults.length === 0) {
        console.log('🔄 Adding "steam_id" column to wishlist_games table...');
        
        try {
          // Add the column
          await sequelize.query(`
            ALTER TABLE wishlist_games 
            ADD COLUMN steam_id INTEGER;
          `);
          console.log('✅ Successfully added "steam_id" column to wishlist_games table');
        } catch (migrationError) {
          console.error('❌ Error adding "steam_id" column:', migrationError.message);
          throw migrationError;
        }
      } else {
        console.log('✅ "steam_id" column already exists in wishlist_games table');
      }

      // Check if 'gameId' column is nullable in wishlist_games table
      const [gameIdResults] = await sequelize.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'wishlist_games' AND column_name = 'gameId';
      `);
      
      if (gameIdResults.length > 0 && gameIdResults[0].is_nullable === 'NO') {
        console.log('🔄 Making "gameId" column nullable in wishlist_games table...');
        
        try {
          // Make the column nullable to match the model
          await sequelize.query(`
            ALTER TABLE wishlist_games 
            ALTER COLUMN "gameId" DROP NOT NULL;
          `);
          console.log('✅ Successfully made "gameId" column nullable in wishlist_games table');
        } catch (migrationError) {
          console.error('❌ Error making "gameId" nullable:', migrationError.message);
          throw migrationError;
        }
      } else if (gameIdResults.length > 0 && gameIdResults[0].is_nullable === 'YES') {
        console.log('✅ "gameId" column is already nullable in wishlist_games table');
      }
    } catch (error) {
      console.error('❌ Error running migrations:', error);
      // Don't throw - allow server to continue, but log the error
      console.error('Migration error details:', error.message);
      console.error('⚠️  Server will continue, but library creation may fail until migration is fixed');
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

  async saveUser(userData) {
    try {

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
      // Include password_hash for authentication purposes
      // Use raw query or explicitly include password_hash in attributes
      // Note: avatar_path may not exist yet, so we handle it gracefully
      const user = await User.findOne({ 
        where: { username },
        attributes: { 
          exclude: [] // Don't exclude anything - we need password_hash
        },
        raw: false // Return Sequelize instance, not plain object
      });
      
      if (user) {
        // Check if avatar_path column exists by trying to access it
        // If it doesn't exist, we'll handle it gracefully
        try {
          const hasAvatarPath = user.dataValues && 'avatar_path' in user.dataValues;
          console.log('User found in database:', {
            username: user.username,
            hasPasswordHash: !!user.password_hash,
            hasAvatarPath: hasAvatarPath,
            fields: Object.keys(user.dataValues || user)
          });
        } catch (e) {
          // Column might not exist yet - that's okay
          console.log('User found in database:', {
            username: user.username,
            hasPasswordHash: !!user.password_hash,
            note: 'avatar_path column may not exist yet'
          });
        }
      }
      
      return user;
    } catch (error) {
      // If error is about missing avatar_path or profile_picture_path column, try query without it
      if (error.message && (error.message.includes('avatar_path') || error.message.includes('profile_picture_path') || error.code === '42703')) {
        console.log('⚠️ avatar_path or profile_picture_path column not found, querying without it...');
        try {
          const user = await User.findOne({ 
            where: { username },
            attributes: [
              'user_id', 'username', 'email', 'password_hash', 'join_date', 
              'is_active', 'is_admin', 'last_login', 'bio', 
              'gaming_preferences', 'statistics', 
              'steam_id', 'steam_profile', 'steam_linked_at', 'steam_games', 'steam_last_sync'
              // Exclude avatar_path and profile_picture_path - will use placeholder image instead
            ],
            raw: false
          });
          // Set avatar_path and profile_picture_path to null since columns don't exist
          if (user && user.dataValues) {
            user.dataValues.avatar_path = null;
            user.dataValues.profile_picture_path = null;
          }
          return user;
        } catch (retryError) {
          console.error('Error getting user by username (retry):', retryError);
          return null;
        }
      }
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
