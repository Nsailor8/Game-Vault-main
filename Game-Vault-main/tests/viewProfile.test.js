/**
 * viewProfile.test.js
 * Fake test for the "View Profile" friends feature.
 * This does not connect to AWS — it mocks the API response.
 */

require('regenerator-runtime/runtime');

async function updateFriends(fetchFn = fetch) {
  const list = document.getElementById('friendsList');
  const count = document.getElementById('friendsCount');
  list.innerHTML = '';

  const res = await fetchFn('/api/friends/testuser');
  const data = await res.json();
  const friends = data.friends || [];
  count.textContent = friends.length;
  
  friends.forEach(friend => {
    const div = document.createElement('div');
    div.className = 'friend-item';
    const date = new Date(friend.acceptedDate).toLocaleDateString();
    div.innerHTML = `
      <div><strong>${friend.username}</strong><br><small>Friends since: ${date}</small></div>
      <button class="view-profile-btn">View Profile</button>
    `;
    list.appendChild(div);
  });
}
test('renders friend and shows formatted date', async () => {
  document.body.innerHTML = `
    <div id="friendsList"></div>
    <span id="friendsCount"></span>
  `;
  const mockData = {
    friends: [
      { username: 'alex', acceptedDate: '2025-11-07T12:00:00.000Z' }
    ]
  };
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => mockData
  });

  await updateFriends(mockFetch);

  expect(document.getElementById('friendsCount').textContent).toBe('1');
  expect(document.querySelector('.friend-item')).not.toBeNull();
  expect(document.querySelector('.friend-item strong').textContent).toBe('alex');
});
