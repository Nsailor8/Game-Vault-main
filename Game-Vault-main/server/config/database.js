const { Sequelize } = require('sequelize');
require('dotenv').config();

// Ensure DB_NAME is always 'postgres' - trim any whitespace
const dbName = (process.env.DB_NAME || 'postgres').trim();

const config = {
  development: {
    username: process.env.DB_USERNAME || 'Game_Vault_Admin',
    password: process.env.DB_PASSWORD || 'GMc84dIkRjTEWUJSmXvG',
    database: dbName,
    host: process.env.DB_HOST || 'game-vault.cgx26cmuk72p.us-east-1.rds.amazonaws.com',
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: (process.env.DB_NAME || 'postgres').trim(),
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Log the database name being used for debugging
console.log(`🔧 Database configuration: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions,
    // Explicitly set the database name to prevent Sequelize from inferring it
    database: dbConfig.database
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  config
};
