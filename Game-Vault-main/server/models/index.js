const { sequelize } = require('../config/database');

const User = require('./User');
const Game = require('./Game');
const Review = require('./Review');
const Wishlist = require('./Wishlist');
const WishlistGame = require('./WishlistGame');
const Friendship = require('./Friendship');
const Achievement = require('./Achievement');
const ReviewHelpfulVote = require('./ReviewHelpfulVote');
const Post = require('./Post');
const Comment = require('./Comment');

const setupAssociations = () => {

  User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
  User.hasMany(Wishlist, { foreignKey: 'userId', as: 'wishlists' });
  User.hasMany(Achievement, { foreignKey: 'userId', as: 'achievements' });
  User.hasMany(ReviewHelpfulVote, { foreignKey: 'userId', as: 'reviewHelpfulVotes', onDelete: 'CASCADE' });
  User.hasMany(Post, { foreignKey: 'userId', as: 'posts' });
  User.hasMany(Comment, { foreignKey: 'userId', as: 'comments' });

  User.belongsToMany(User, {
    through: Friendship,
    as: 'friends',
    foreignKey: 'userId',
    otherKey: 'friendId',
    sourceKey: 'user_id',
    targetKey: 'user_id'
  });
  
  // Friendship belongsTo associations - use sourceKey to map to user_id
  Friendship.belongsTo(User, { 
    foreignKey: 'userId', 
    as: 'user',
    targetKey: 'user_id'
  });
  Friendship.belongsTo(User, { 
    foreignKey: 'friendId', 
    as: 'friend',
    targetKey: 'user_id'
  });
  
  // Review associations
  Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Review.belongsTo(Game, { foreignKey: 'gameId', as: 'game' });
  Review.hasMany(ReviewHelpfulVote, { foreignKey: 'reviewId', as: 'helpfulVotesRecords', onDelete: 'CASCADE' });

  ReviewHelpfulVote.belongsTo(Review, { foreignKey: 'reviewId', as: 'review' });
  ReviewHelpfulVote.belongsTo(User, { foreignKey: 'userId', as: 'voter' });

  Game.hasMany(Review, { foreignKey: 'gameId', as: 'reviews' });
  Game.belongsToMany(Wishlist, { 
    through: WishlistGame, 
    foreignKey: 'gameId', 
    otherKey: 'wishlistId' 
  });

  Wishlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Wishlist.belongsToMany(Game, { 
    through: WishlistGame, 
    foreignKey: 'wishlistId', 
    otherKey: 'gameId' 
  });

  Achievement.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  WishlistGame.belongsTo(Wishlist, { foreignKey: 'wishlistId' });
  WishlistGame.belongsTo(Game, { foreignKey: 'gameId' });

  // Post associations
  Post.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments', onDelete: 'CASCADE' });

  // Comment associations
  Comment.belongsTo(Post, { foreignKey: 'postId', as: 'post' });
  Comment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Comment.belongsTo(Comment, { foreignKey: 'parentCommentId', as: 'parentComment' });
  Comment.hasMany(Comment, { foreignKey: 'parentCommentId', as: 'replies', onDelete: 'CASCADE' });
};

setupAssociations();

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
  ReviewHelpfulVote,
  Post,
  Comment,
  syncDatabase
};
