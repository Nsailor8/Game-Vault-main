const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const Game = require('./Game');
const Review = require('./Review');
const Wishlist = require('./Wishlist');
const WishlistGame = require('./WishlistGame');
const Friendship = require('./Friendship');
const Achievement = require('./Achievement');

// Define associations
const setupAssociations = () => {
  // User associations
  User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
  User.hasMany(Wishlist, { foreignKey: 'userId', as: 'wishlists' });
  User.hasMany(Achievement, { foreignKey: 'userId', as: 'achievements' });
  
  // Friendship associations (self-referencing)
  User.belongsToMany(User, {
    through: Friendship,
    as: 'friends',
    foreignKey: 'userId',
    otherKey: 'friendId'
  });
  
  // Friendship belongsTo associations
  Friendship.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Friendship.belongsTo(User, { foreignKey: 'friendId', as: 'friend' });
  
  // Review associations
  Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Review.belongsTo(Game, { foreignKey: 'gameId', as: 'game' });
  
  // Game associations
  Game.hasMany(Review, { foreignKey: 'gameId', as: 'reviews' });
  Game.belongsToMany(Wishlist, { 
    through: WishlistGame, 
    foreignKey: 'gameId', 
    otherKey: 'wishlistId' 
  });
  
  // Wishlist associations
  Wishlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Wishlist.belongsToMany(Game, { 
    through: WishlistGame, 
    foreignKey: 'wishlistId', 
    otherKey: 'gameId' 
  });
  
  // Achievement associations
  Achievement.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  
  // WishlistGame associations
  WishlistGame.belongsTo(Wishlist, { foreignKey: 'wishlistId' });
  WishlistGame.belongsTo(Game, { foreignKey: 'gameId' });
};

// Setup associations
setupAssociations();

// Sync database (create tables if they don't exist)
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log('✅ Database synchronized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error synchronizing database:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  User,
  Game,
  Review,
  Wishlist,
  WishlistGame,
  Friendship,
  Achievement,
  syncDatabase
};
