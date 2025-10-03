// Wishlist Item Class
class WishlistItem {
  constructor(id, title, platform, priority, price, releaseDate, tags, notes) {
    this.id = id;
    this.title = title;
    this.platform = platform;
    this.priority = priority; // 'high', 'medium', 'low'
    this.price = price;
    this.releaseDate = releaseDate;
    this.tags = tags;
    this.notes = notes;
    this.dateAdded = new Date().toISOString().split('T')[0];
  }

  toString() {
    return `ID: ${this.id} | Title: ${this.title} | Platform: ${this.platform} | Priority: ${this.priority} | Price: $${this.price} | Release: ${this.releaseDate} | Tags: ${this.tags.join(', ')}${this.notes ? ` | Notes: ${this.notes}` : ''}`;
  }
}

// Wishlist Manager Class
class WishlistManager {
  constructor() {
    this.wishlist = [];
    this.nextId = 1;
  }

  addItem(title, platform, priority = 'medium', price = 0, releaseDate = 'TBA', tags = [], notes = '') {
    const item = new WishlistItem(
      this.nextId++,
      title,
      platform,
      priority,
      price,
      releaseDate,
      tags,
      notes
    );
    this.wishlist.push(item);
    console.log(`Added to wishlist: ${title}`);
    return item;
  }

  removeItem(id) {
    const index = this.wishlist.findIndex(item => item.id === id);
    if (index !== -1) {
      const removed = this.wishlist.splice(index, 1)[0];
      console.log(`Removed from wishlist: ${removed.title}`);
      return true;
    } else {
      console.log(`Wishlist item not found with ID: ${id}`);
      return false;
    }
  }

  updatePriority(id, newPriority) {
    const validPriorities = ['high', 'medium', 'low'];
    if (!validPriorities.includes(newPriority.toLowerCase())) {
      console.log('Priority must be: high, medium, or low');
      return false;
    }
    const item = this.findItemById(id);
    if (item) {
      item.priority = newPriority.toLowerCase();
      console.log(`Priority updated to: ${newPriority}`);
      return true;
    } else {
      console.log(`Wishlist item not found with ID: ${id}`);
      return false;
    }
  }

  updatePrice(id, newPrice) {
    const item = this.findItemById(id);
    if (item) {
      item.price = newPrice;
      console.log(`Price updated to: $${newPrice}`);
      return true;
    } else {
      console.log(`Wishlist item not found with ID: ${id}`);
      return false;
    }
  }

  updateNotes(id, notes) {
    const item = this.findItemById(id);
    if (item) {
      item.notes = notes;
      console.log('Notes updated successfully');
      return true;
    } else {
      console.log(`Wishlist item not found with ID: ${id}`);
      return false;
    }
  }

  searchWishlist(keyword) {
    return this.wishlist.filter(item =>
      item.title.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  filterByPriority(priority) {
    return this.wishlist.filter(item =>
      item.priority.toLowerCase() === priority.toLowerCase()
    );
  }

  filterByPlatform(platform) {
    return this.wishlist.filter(item =>
      item.platform.toLowerCase() === platform.toLowerCase()
    );
  }

  filterByTag(tag) {
    return this.wishlist.filter(item =>
      item.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }

  sortByPriority() {
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    return [...this.wishlist].sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  sortByPrice(ascending = true) {
    return [...this.wishlist].sort((a, b) =>
      ascending ? a.price - b.price : b.price - a.price
    );
  }

  getAllItems() {
    return [...this.wishlist];
  }

  displayAllItems() {
    if (this.wishlist.length === 0) {
      console.log('Wishlist is empty.');
      return;
    }
    console.log('\n=== WISHLIST ===');
    this.wishlist.forEach(item => console.log(item.toString()));
    console.log(`Total items: ${this.wishlist.length}`);
  }

  displayByPriority() {
    const grouped = this.wishlist.reduce((acc, item) => {
      if (!acc[item.priority]) {
        acc[item.priority] = [];
      }
      acc[item.priority].push(item);
      return acc;
    }, {});

    console.log('\n=== WISHLIST BY PRIORITY ===');
    ['high', 'medium', 'low'].forEach(priority => {
      if (grouped[priority]) {
        console.log(`\n${priority.toUpperCase()} PRIORITY:`);
        grouped[priority].forEach(item => console.log(item.toString()));
      }
    });
  }

  getTotalCost() {
    return this.wishlist.reduce((sum, item) => sum + item.price, 0).toFixed(2);
  }

  getStatistics() {
    const stats = {
      total: this.wishlist.length,
      byPriority: {},
      byPlatform: {},
      totalCost: this.getTotalCost(),
      avgPrice: 0
    };

    this.wishlist.forEach(item => {
      stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
      stats.byPlatform[item.platform] = (stats.byPlatform[item.platform] || 0) + 1;
    });

    if (this.wishlist.length > 0) {
      const totalPrice = this.wishlist.reduce((sum, item) => sum + item.price, 0);
      stats.avgPrice = (totalPrice / this.wishlist.length).toFixed(2);
    }

    return stats;
  }

  findItemById(id) {
    return this.wishlist.find(item => item.id === id);
  }

  // Move item from wishlist to game library
  moveToLibrary(id, gameLibraryManager, status = 'backlog', rating = 0, playtime = '0 hours') {
    const item = this.findItemById(id);
    if (item) {
      gameLibraryManager.addGame(
        item.title,
        item.platform,
        status,
        rating,
        playtime,
        item.tags
      );
      this.removeItem(id);
      console.log(`Moved "${item.title}" to game library`);
      return true;
    } else {
      console.log(`Wishlist item not found with ID: ${id}`);
      return false;
    }
  }
}

// Usage Example:
// const wishlist = new WishlistManager();
// const library = new GameLibraryManager();
// 
// wishlist.addItem('Hollow Knight', 'Steam', 'high', 14.99, '2017-02-24', ['Metroidvania', 'Indie']);
// wishlist.addItem('God of War', 'PlayStation', 'medium', 39.99, '2018-04-20', ['Action', 'Adventure']);
// wishlist.displayAllItems();
// wishlist.moveToLibrary(1, library);
