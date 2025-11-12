const GameSearchService = require('../GameSearchService');

describe('GameSearchService helper behavior', () => {
  let service;

  beforeEach(() => {
    service = new GameSearchService();
  });

  test('removeSimilarTitles filters out duplicate games with similar names', () => {
    const games = [
      { id: 1, name: 'The Legend of Zelda: Breath of the Wild' },
      { id: 2, name: 'Legend of Zelda Breath of the Wild' },
      { id: 3, name: 'Super Mario Odyssey!' },
      { id: 4, name: 'Super Mario Odyssey' }
    ];

    const uniqueGames = service.removeSimilarTitles(games);

    expect(uniqueGames).toHaveLength(2);
    expect(uniqueGames.map(game => game.name)).toEqual([
      'The Legend of Zelda: Breath of the Wild',
      'Super Mario Odyssey!'
    ]);
  });

  test('formatIGDBGameData normalizes values from IGDB format', () => {
    const igdbGame = {
      id: 42,
      name: 'Sample Game',
      summary: 'An epic adventure.',
      rating: 85,
      rating_count: 250,
      first_release_date: new Date('2022-10-20').getTime() / 1000,
      cover: { url: '//images.igdb.com/igdb/image/upload/t_thumb/sample.jpg' },
      platforms: [{ id: 1, name: 'PC' }],
      genres: [{ id: 5, name: 'Action' }]
    };

    const formatted = service.formatIGDBGameData(igdbGame);

    expect(formatted).toMatchObject({
      id: 42,
      name: 'Sample Game',
      slug: 'sample-game',
      description_raw: 'An epic adventure.',
      released: '2022-10-20',
      rating: 4.3,
      rating_top: 5,
      ratings_count: 250,
      platforms: [{ id: 1, name: 'PC', slug: 'pc' }],
      genres: [{ id: 5, name: 'Action', slug: 'action' }]
    });
    expect(formatted.background_image).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/sample.jpg');
  });

  test('searchGames falls back to mock data when credentials are missing', async () => {
    const results = await service.searchGames('Metroid');

    expect(results.success).toBe(true);
    expect(results.isMockData).toBe(true);
    expect(results.games.length).toBeGreaterThan(0);
    expect(results.games[0]).toMatchObject({
      name: expect.stringContaining('Metroid'),
      slug: expect.any(String)
    });
  });
});

