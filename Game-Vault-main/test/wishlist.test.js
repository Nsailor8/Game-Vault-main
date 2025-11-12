const test = require('node:test');
const assert = require('node:assert/strict');

const { WishlistManager } = require('../simple-managers/wishlist');

test('addItem assigns incremental ids and captures core fields', () => {
  const manager = new WishlistManager();

  const first = manager.addItem('Hollow Knight', 'PC', 'high', 29.99, '2017-02-24', ['metroidvania']);
  const second = manager.addItem('Stardew Valley', 'Switch');

  assert.equal(first.id, 1);
  assert.equal(second.id, 2);
  assert.equal(first.priority, 'high');
  assert.equal(second.priority, 'medium');

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  assert.match(first.dateAdded, datePattern);
  assert.match(second.dateAdded, datePattern);

  assert.equal(manager.getAllItems().length, 2);
});

test('updatePriority rejects invalid priorities and preserves previous value', () => {
  const manager = new WishlistManager();
  const item = manager.addItem('The Witcher 3', 'PC', 'low');

  const updated = manager.updatePriority(item.id, 'HIGH');
  const rejected = manager.updatePriority(item.id, 'urgent');

  assert.equal(updated, true);
  assert.equal(rejected, false);
  assert.equal(manager.findItemById(item.id).priority, 'high');
});

test('getStatistics reports accurate totals and pricing', () => {
  const manager = new WishlistManager();
  manager.addItem('Celeste', 'PC', 'high', 19.99, '2018-01-25', ['platformer']);
  manager.addItem('Ori and the Blind Forest', 'Xbox', 'medium', 14.99, '2015-03-11', ['platformer']);
  manager.addItem('Death Stranding', 'PS5', 'low', 49.99, '2020-09-24', ['adventure']);

  const stats = manager.getStatistics();

  assert.equal(stats.total, 3);
  assert.deepEqual(stats.byPriority, { high: 1, medium: 1, low: 1 });
  assert.deepEqual(stats.byPlatform, { PC: 1, Xbox: 1, PS5: 1 });
  assert.equal(stats.totalCost, '84.97');
  assert.equal(stats.avgPrice, '28.32');
});

test('moveToLibrary transfers item and clears it from wishlist', () => {
  const manager = new WishlistManager();
  const stubLibrary = {
    addedGames: [],
    addGame(title, platform, status, rating, playtime, tags) {
      this.addedGames.push({ title, platform, status, rating, playtime, tags });
    }
  };

  const item = manager.addItem('Vampire Survivors', 'PC', 'medium', 4.99, '2021-12-17', ['roguelike']);
  const moved = manager.moveToLibrary(item.id, stubLibrary, 'completed', 5, '120 hours');

  assert.equal(moved, true);
  assert.equal(manager.getAllItems().length, 0);
  assert.deepEqual(stubLibrary.addedGames[0], {
    title: 'Vampire Survivors',
    platform: 'PC',
    status: 'completed',
    rating: 5,
    playtime: '120 hours',
    tags: ['roguelike']
  });
});

