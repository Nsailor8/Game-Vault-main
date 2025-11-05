const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Game = sequelize.define('Game', {
  game_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'game_id'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200]
    }
  },
  genre: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  developer: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  release_date: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'release_date'
  }
}, {
  tableName: 'games',
  timestamps: false, // Disable automatic timestamps since the existing table doesn't have them
  indexes: [
    {
      fields: ['title']
    },
    {
      fields: ['genre']
    }
  ]
});

module.exports = Game;
