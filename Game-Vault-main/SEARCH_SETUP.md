# Game Search Setup Instructions

## Overview
The search functionality has been implemented to search games from the RAWG.io database. This allows users to search for games by title or keywords and view detailed information about each game.

## Setup Instructions

### 1. Get a RAWG.io API Key
1. Visit [RAWG.io API Documentation](https://rawg.io/apidocs)
2. Sign up for a free account
3. Get your API key from the dashboard

### 2. Configure Environment Variables
1. Copy the `env.example` file to `.env`:
   ```bash
   cp env.example .env
   ```

2. Edit the `.env` file and replace `your-rawg-api-key-here` with your actual API key:
   ```
   RAWG_API_KEY=your-actual-api-key-here
   ```

### 3. Install Dependencies
The required dependencies are already installed, but if you need to reinstall:
```bash
npm install
```

### 4. Start the Server
```bash
npm start
```

## Features

### Search Functionality
- **Search by Title**: Users can search for games by typing the game title or keywords
- **Real-time Results**: Results are fetched from the RAWG.io database in real-time
- **Pagination**: Large result sets are paginated for better performance
- **Rich Game Information**: Each game shows:
  - Game title and description
  - Release date and ratings
  - Available platforms
  - Genres
  - Screenshots and background images
  - Metacritic scores

### User Interface
- **Search Bar**: Located in the header, allows users to type search queries
- **Search Results Modal**: Displays search results in a beautiful, responsive modal
- **Game Cards**: Each game is displayed in an attractive card format
- **Action Buttons**: Users can view game details or add games to their wishlist

### Technical Implementation
- **Backend**: Express.js server with RAWG.io API integration
- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Styling**: Responsive CSS with modern design principles
- **Error Handling**: Comprehensive error handling for network issues and API failures

## API Endpoints

### Search Games
```
GET /api/games/search?q={query}&page={page}&pageSize={pageSize}
```

### Get Game Details
```
GET /api/games/{gameId}
```

## Usage

1. **Search for Games**: Type a game title or keyword in the search bar and press Enter or click the search button
2. **Browse Results**: View the search results in the modal that opens
3. **View Details**: Click "View Details" to see more information about a specific game
4. **Add to Wishlist**: Click "Add to Wishlist" to add games to your wishlist (requires login)

## Troubleshooting

### Common Issues

1. **"Failed to search games" Error**
   - Check if your RAWG.io API key is correctly set in the `.env` file
   - Verify that the API key is valid and has not expired
   - Check your internet connection

2. **No Results Found**
   - Try different search terms
   - Check if the game exists in the RAWG.io database
   - Try searching with partial titles or keywords

3. **Slow Search Performance**
   - The search speed depends on the RAWG.io API response time
   - Large result sets may take longer to load
   - Consider using more specific search terms

### Rate Limiting
- RAWG.io has rate limits for free API keys
- If you exceed the rate limit, you may need to wait before making more requests
- Consider upgrading to a paid plan for higher rate limits

## Development Notes

- The search service is implemented in `server/services/GameSearchService.js`
- Frontend search logic is in `public/app.js`
- Search result styling is in `public/styles.css`
- The search modal is dynamically created and managed by JavaScript

## Future Enhancements

- Advanced filtering options (by platform, genre, release date)
- Search history
- Favorites system
- Game comparison features
- Integration with user reviews and ratings
