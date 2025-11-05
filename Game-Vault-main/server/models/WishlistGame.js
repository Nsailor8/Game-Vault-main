const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WishlistGame = sequelize.define('WishlistGame', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  wishlistId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'wishlists',
      key: 'id'
    }
  },
  gameId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'games',
      key: 'id'
    }
  },
  gameTitle: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  platform: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    allowNull: false,
    defaultValue: 'medium'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'wishlist_games',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['wishlistId']
    },
    {
      fields: ['gameId']
    },
    {
      unique: true,
      fields: ['wishlistId', 'gameId']
    }
  ]
});

module.exports = WishlistGame;
