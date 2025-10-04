# Game Vault - Profile System

A comprehensive profile management system for Game Vault with social features, wishlists, reviews, and admin panel.

## Features

- **User Profiles**: Complete profile management with gaming preferences and statistics
- **Authentication**: Secure login/signup system with password protection
- **Social Features**: Friends list, friend requests, and user blocking
- **Wishlists**: Create and manage multiple game wishlists
- **Reviews**: Rate and review games with tags and ratings
- **Admin Panel**: Administrative functions with system logs and user statistics
- **Modern UI**: Beautiful, responsive web interface with gradient design
- **Real-time Updates**: Dynamic UI updates without page refresh


## Launch Instructions for Anyone

### Method 1: Command Line (Recommended)
```bash
# Navigate to the project folder
cd Game-Vault-main

# Install dependencies (only needed once)
npm install

# Start the server
npm start
```

### Method 2: VS Code / Cursor IDE
1. Open the project in VS Code or Cursor
2. Go to **Run and Debug** (Ctrl+Shift+D)
3. Select **"Launch Game Vault Server"** from the dropdown
4. Click the **Play button** or press F5

### Method 3: Windows Batch File
If you have the `start-server.bat` file:
1. Double-click `start-server.bat`
2. Wait for "Server running on port 3000"
3. Open browser to `http://localhost:3000`

### Method 4: Manual Node.js
```bash
# Navigate to project folder
cd Game-Vault-main

# Run server directly
node server.js
```

## Project Structure

```
Game-Vault-main/
├── index.html          # Main web interface
├── styles.css          # Modern CSS styling
├── app.js             # Frontend JavaScript
├── profile.js         # Core profile system classes
├── server.js          # Express.js server
├── package.json       # Node.js dependencies
└── README.md         # This file
```

## 🎯 Core Classes

- **UserProfile**: User data, preferences, statistics, and achievements
- **ProfileManager**: Central management for all profile operations
- **FriendsList**: Social features and friend management
- **WishlistManager**: Game wishlist creation and management
- **ReviewManager**: Game review system with ratings
- **AdminManager**: Administrative functions and system logging
- **DatabaseManager**: Data persistence and export/import

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration

### Profile Management
- `GET /api/profile/:username` - Get user profile
- `PUT /api/profile/:username` - Update user profile

### Social Features
- `GET /api/friends/:username` - Get friends list
- `POST /api/friends/:username/add` - Send friend request

### Wishlists
- `GET /api/wishlists/:username` - Get user wishlists
- `POST /api/wishlists/:username/create` - Create new wishlist

### Reviews
- `GET /api/reviews/:username` - Get user reviews
- `POST /api/reviews/:username/add` - Add new review

### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/stats` - Get system statistics

## UI Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern Gradient Theme**: Beautiful purple-blue gradient design
- **Interactive Modals**: Smooth modal animations and transitions
- **Real-time Updates**: Dynamic content updates without page refresh
- **Font Awesome Icons**: Professional iconography throughout
- **Loading States**: Visual feedback for user actions

## Customization

### Adding New Features
1. Extend the appropriate class in `profile.js`
2. Add UI components to `index.html`
3. Style new elements in `styles.css`
4. Add JavaScript functionality in `app.js`
5. Create API endpoints in `server.js`

### Styling
The CSS uses CSS Grid and Flexbox for modern layouts. Key color variables:
- Primary: `#667eea` (Purple-blue)
- Secondary: `#764ba2` (Darker purple)
- Background: Gradient from primary to secondary

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process using port 3000
   npx kill-port 3000
   # Or use a different port
   PORT=3001 npm start
   ```

2. **Dependencies not installed**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Browser not loading**
   - Check if server is running: `http://localhost:3000`
   - Clear browser cache
   - Try incognito/private mode
