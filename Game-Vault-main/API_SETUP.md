# 🎮 Game Vault - API Setup Guide

## 🚀 **Setting Up Free IGDB API for Real Game Data**

### **✅ Step 1: Your IGDB Client ID is Ready!**
- **Client ID:** `00fyknnphkp5xv0w2unnbcavrtyb7x` ✅

### **🔑 Step 2: Get Your Client Secret**

1. **Go to your Twitch application:** https://dev.twitch.tv/console/apps
2. **Click on your "Game Vault" application**
3. **Click "Manage" next to your application**
4. **Copy the "Client Secret"** (it will look like: `abc123def456ghi789jkl012mno345pqr`)
5. **Replace `your-client-secret-here` in your `.env` file** with your actual Client Secret

### **Step 2: Create Your .env File**

Create a file called `.env` in your project root with this content:

```env
# Database Configuration
DB_DIALECT=postgres
DB_HOST=game-vault.cgx26cmuk72p.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME= Game_Vault
DB_USERNAME=Game_Vault_Admin
DB_PASSWORD=GMc84dIkRjTEWUJSmXvG
DB_SSL=true

# Environment
NODE_ENV=development
PORT=3000

# IGDB API Configuration (Twitch Developer Console)
# Your Client ID is already set!
IGDB_CLIENT_ID=00fyknnphkp5xv0w2unnbcavrtyb7x
IGDB_CLIENT_SECRET=your-client-secret-here

# Session Secret
SESSION_SECRET=game-vault-secret-key-2024
```

### **Step 3: Add Your API Credentials**

Replace `your-client-id-here` and `your-client-secret-here` with your actual IGDB credentials.

### **Step 4: Restart the Server**

After adding your API credentials, restart the server:

```bash
npm start
```

## 🎯 **What This Will Give You**

- **Real game data** from IGDB's database of 500,000+ games
- **Game images, descriptions, ratings, and metadata**
- **Platform information** (PC, PlayStation, Xbox, Nintendo, etc.)
- **Genre and developer information**
- **Release dates and ratings**
- **High-quality game covers and screenshots**

## 🔧 **Alternative Free APIs**

If IGDB doesn't work, here are other free gaming APIs:

1. **RAWG.io** - https://rawg.io/apidocs (original choice)
2. **Steam API** - https://steamcommunity.com/dev
3. **Giant Bomb API** - https://www.giantbomb.com/api/

## 📝 **Current Status**

- ✅ Server is running
- ✅ Database is connected
- ✅ Session management is working
- ✅ **IGDB API integration ready**
- ✅ **Client ID configured:** `00fyknnphkp5xv0w2unnbcavrtyb7x`
- ✅ **Client Secret configured:** `8gchhlw6bjvmh0kus25dmh5n71gyef`
- 🎮 **Real game data is now enabled!**

The search will now show real games from the IGDB database instead of mock data!

## 🚀 **Quick Start (No API Setup)**

If you want to test the app immediately without setting up an API:

1. **The app will use mock data** (sample games)
2. **All features work** (search, wishlist, reviews, etc.)
3. **You can add real API later** for actual game data

The mock data includes sample games like "Sample Game: [your search]" so you can test all functionality!
