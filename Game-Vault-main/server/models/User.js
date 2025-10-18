const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'user_id'
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
    validate: {
      notEmpty: true
    }
  },
  join_date: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'join_date',
    defaultValue: DataTypes.NOW
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    field: 'is_active',
    defaultValue: true
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    field: 'is_admin',
    defaultValue: false
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: ''
  },
  // Gaming preferences as JSON
  gaming_preferences: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'gaming_preferences',
    defaultValue: {
      favoriteGenres: [],
      preferredPlatforms: [],
      playStyle: 'casual',
      gamingGoals: []
    }
  },
  // Statistics as JSON
  statistics: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {
      totalGamesPlayed: 0,
      totalPlaytime: 0,
      averageRating: 0,
      favoriteGame: null,
      mostPlayedPlatform: null,
      completionRate: 0,
      totalReviews: 0,
      friendsCount: 0
    }
  }
}, {
  tableName: 'users',
  timestamps: false, // Disable automatic timestamps since the existing table doesn't have them
  indexes: [
    {
      unique: true,
      fields: ['username']
    },
    {
      unique: true,
      fields: ['email']
    }
  ]
});

module.exports = User;
