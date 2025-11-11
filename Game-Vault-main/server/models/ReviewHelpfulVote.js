const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReviewHelpfulVote = sequelize.define('ReviewHelpfulVote', {
  reviewId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'reviews',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'review_helpful_votes',
  updatedAt: false
});

module.exports = ReviewHelpfulVote;
