// Web Application JavaScript
class GameVaultApp {
    constructor() {
        this.profileManager = new ProfileManager();
        this.adminManager = new AdminManager();
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showAuthModal();
        this.loadSampleData();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        // Auth Modal
        document.getElementById('showSignup').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSignupForm();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        document.getElementById('loginBtn').addEventListener('click', () => {
            this.handleLogin();
        });

        document.getElementById('signupBtn').addEventListener('click', () => {
            this.handleSignup();
        });

        // Profile
        document.getElementById('editProfileBtn').addEventListener('click', () => {
            this.showEditProfileModal();
        });

        document.getElementById('saveProfileBtn').addEventListener('click', () => {
            this.saveProfile();
        });

        // Friends
        document.getElementById('addFriendBtn').addEventListener('click', () => {
            this.showAddFriendModal();
        });

        document.getElementById('sendFriendRequestBtn').addEventListener('click', () => {
            this.sendFriendRequest();
        });

        // Wishlist
        document.getElementById('createWishlistBtn').addEventListener('click', () => {
            this.showCreateWishlistModal();
        });

        document.getElementById('createWishlistConfirmBtn').addEventListener('click', () => {
            this.createWishlist();
        });

        // Reviews
        document.getElementById('addReviewBtn').addEventListener('click', () => {
            this.showAddReviewModal();
        });

        document.getElementById('addReviewConfirmBtn').addEventListener('click', () => {
            this.addReview();
        });
        document.getElementById("globalSearchBtn").addEventListener("click", () => {
            const query = document.getElementById("globalSearchInput").value.trim().toLowerCase();
            if (!query) return;

            console.log("Searching for:", query);
            // 🔹 Example: filter across friends, wishlists, reviews, etc.
            // You can add real search logic here.
        });


        // Admin
        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            this.showAdminLoginModal();
        });

        document.getElementById('adminLoginConfirmBtn').addEventListener('click', () => {
            this.handleAdminLogin();
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
    }

    loadSampleData() {
        // Create sample admin
        this.adminManager.createAdmin('admin', 'admin@gamevault.com', 'admin123');
        
        // Create sample users
        this.profileManager.signUp('GameMaster2024', 'gamemaster@example.com', 'password123', {
            favoriteGenres: ['RPG', 'Action', 'Indie'],
            preferredPlatforms: ['Steam', 'Nintendo'],
            playStyle: 'hardcore',
            gamingGoals: ['Complete all achievements', 'Try new genres']
        });

        this.profileManager.signUp('CasualGamer', 'casual@example.com', 'password456', {
            favoriteGenres: ['Puzzle', 'Platformer'],
            preferredPlatforms: ['Nintendo'],
            playStyle: 'casual',
            gamingGoals: ['Have fun', 'Relax after work']
        });
    }

    showAuthModal() {
        document.getElementById('authModal').style.display = 'block';
    }

    closeModal(modal) {
        modal.style.display = 'none';
    }

    showLoginForm() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('authTitle').textContent = 'Login to Game Vault';
    }

    showSignupForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
        document.getElementById('authTitle').textContent = 'Join Game Vault';
    }

    handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            alert('Please fill in all fields');
            return;
        }

        const user = this.profileManager.login(username, password);
        if (user) {
            this.currentUser = user;
            this.closeModal(document.getElementById('authModal'));
            this.updateUI();
        } else {
            alert('Invalid credentials');
        }
    }

    handleSignup() {
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const playStyle = document.getElementById('playStyle').value;
        const favoriteGenres = document.getElementById('favoriteGenres').value.split(',').map(g => g.trim()).filter(g => g);
        const preferredPlatforms = document.getElementById('preferredPlatforms').value.split(',').map(p => p.trim()).filter(p => p);

        if (!username || !email || !password) {
            alert('Please fill in all required fields');
            return;
        }

        const gamingPreferences = {
            favoriteGenres,
            preferredPlatforms,
            playStyle,
            gamingGoals: ['Explore new games', 'Build collection']
        };

        const user = this.profileManager.signUp(username, email, password, gamingPreferences);
        if (user) {
            this.currentUser = user;
            this.closeModal(document.getElementById('authModal'));
            this.updateUI();
        } else {
            alert('Username already exists');
        }
    }

    updateUI() {
        if (!this.currentUser) return;

        // Update profile section
        document.getElementById('profileUsername').textContent = this.currentUser.username;
        document.getElementById('profileEmail').textContent = this.currentUser.email;
        document.getElementById('profileJoinDate').textContent = `Joined: ${new Date(this.currentUser.joinDate).toLocaleDateString()}`;
        document.getElementById('profileBio').textContent = this.currentUser.bio || 'No bio set';
        
        // Update statistics
        document.getElementById('totalGames').textContent = this.currentUser.statistics.totalGamesPlayed;
        document.getElementById('totalPlaytime').textContent = this.currentUser.statistics.totalPlaytime;
        document.getElementById('avgRating').textContent = this.currentUser.statistics.averageRating;
        document.getElementById('achievementCount').textContent = this.currentUser.achievements.length;

        // Update gaming preferences
        document.getElementById('playStyleDisplay').textContent = this.currentUser.gamingPreferences.playStyle;
        document.getElementById('favoriteGenresDisplay').textContent = this.currentUser.gamingPreferences.favoriteGenres.join(', ') || 'None set';
        document.getElementById('preferredPlatformsDisplay').textContent = this.currentUser.gamingPreferences.preferredPlatforms.join(', ') || 'None set';

        // Update achievements
        this.updateAchievements();

        // Update friends
        this.updateFriends();

        // Update wishlists
        this.updateWishlists();

        // Update reviews
        this.updateReviews();
    }

    updateAchievements() {
        const container = document.getElementById('achievementsList');
        container.innerHTML = '';

        if (this.currentUser.achievements.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>No Achievements Yet</h3>
                    <p>Start gaming to unlock achievements!</p>
                </div>
            `;
            return;
        }

        this.currentUser.achievements.forEach(achievement => {
            const achievementCard = document.createElement('div');
            achievementCard.className = 'achievement-card';
            achievementCard.innerHTML = `
                <i class="fas fa-trophy"></i>
                <h4>${achievement.name}</h4>
                <p>${achievement.description}</p>
                <small>Earned: ${new Date(achievement.earnedDate).toLocaleDateString()}</small>
            `;
            container.appendChild(achievementCard);
        });
    }

    updateFriends() {
        const friendsList = this.profileManager.getFriendsList();
        const container = document.getElementById('friendsList');
        
        if (!friendsList) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h3>No Friends</h3><p>Add some friends to get started!</p></div>';
            return;
        }

        const friends = friendsList.getFriendsList();
        container.innerHTML = '';

        if (friends.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h3>No Friends</h3><p>Add some friends to get started!</p></div>';
            return;
        }

        friends.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.innerHTML = `
                <div>
                    <strong>${friend.username}</strong>
                    <br>
                    <small>Added: ${new Date(friend.addedDate).toLocaleDateString()}</small>
                </div>
                <button class="btn btn-danger" onclick="app.removeFriend('${friend.username}')">Remove</button>
            `;
            container.appendChild(friendItem);
        });

        // Update pending requests
        const pendingContainer = document.getElementById('pendingRequests');
        const pendingRequests = friendsList.getPendingRequests();
        
        if (pendingRequests.length === 0) {
            pendingContainer.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><h3>No Pending Requests</h3></div>';
            return;
        }

        pendingContainer.innerHTML = '';
        pendingRequests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'friend-item';
            requestItem.innerHTML = `
                <div>
                    <strong>${request.targetUsername}</strong>
                    <br>
                    <small>Sent: ${new Date(request.sentDate).toLocaleDateString()}</small>
                </div>
                <button class="btn btn-primary" onclick="app.acceptFriendRequest('${request.targetId}')">Accept</button>
            `;
            pendingContainer.appendChild(requestItem);
        });
    }

    updateWishlists() {
        const wishlistManager = this.profileManager.getWishlistManager();
        const container = document.getElementById('wishlistsList');
        
        if (!wishlistManager) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><h3>No Wishlists</h3><p>Create your first wishlist!</p></div>';
            return;
        }

        const wishlists = wishlistManager.getWishlists();
        container.innerHTML = '';

        if (wishlists.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><h3>No Wishlists</h3><p>Create your first wishlist!</p></div>';
            return;
        }

        wishlists.forEach(wishlist => {
            const wishlistItem = document.createElement('div');
            wishlistItem.className = 'wishlist-item';
            wishlistItem.innerHTML = `
                <div>
                    <strong>${wishlist.name}</strong>
                    <br>
                    <small>${wishlist.gameCount} games • Created: ${new Date(wishlist.createdDate).toLocaleDateString()}</small>
                </div>
                <button class="btn btn-primary" onclick="app.selectWishlist(${wishlist.id})">View</button>
            `;
            container.appendChild(wishlistItem);
        });
    }

    updateReviews() {
        const reviewManager = this.profileManager.getReviewManager();
        const container = document.getElementById('reviewsList');
        
        if (!reviewManager) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><h3>No Reviews</h3><p>Write your first review!</p></div>';
            return;
        }

        const reviews = reviewManager.getReviews();
        document.getElementById('totalReviews').textContent = reviews.length;
        document.getElementById('avgReviewRating').textContent = reviewManager.getAverageRating();

        container.innerHTML = '';

        if (reviews.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><h3>No Reviews</h3><p>Write your first review!</p></div>';
            return;
        }

        reviews.forEach(review => {
            const reviewItem = document.createElement('div');
            reviewItem.className = 'review-item';
            reviewItem.innerHTML = `
                <div>
                    <strong>${review.gameTitle}</strong>
                    <br>
                    <div class="rating">
                        ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                    </div>
                    <p>${review.reviewText}</p>
                    <small>${new Date(review.createdDate).toLocaleDateString()}</small>
                </div>
                <button class="btn btn-danger" onclick="app.deleteReview(${review.id})">Delete</button>
            `;
            container.appendChild(reviewItem);
        });
    }

    switchSection(sectionName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}Section`).classList.add('active');
    }

    showEditProfileModal() {
        if (!this.currentUser) return;

        document.getElementById('editBio').value = this.currentUser.bio || '';
        document.getElementById('editFavoriteGenres').value = this.currentUser.gamingPreferences.favoriteGenres.join(', ');
        document.getElementById('editPreferredPlatforms').value = this.currentUser.gamingPreferences.preferredPlatforms.join(', ');
        document.getElementById('editPlayStyle').value = this.currentUser.gamingPreferences.playStyle;

        document.getElementById('editProfileModal').style.display = 'block';
    }

    saveProfile() {
        if (!this.currentUser) return;

        const bio = document.getElementById('editBio').value;
        const favoriteGenres = document.getElementById('editFavoriteGenres').value.split(',').map(g => g.trim()).filter(g => g);
        const preferredPlatforms = document.getElementById('editPreferredPlatforms').value.split(',').map(p => p.trim()).filter(p => p);
        const playStyle = document.getElementById('editPlayStyle').value;

        this.profileManager.updateCurrentProfile({
            bio,
            gamingPreferences: {
                favoriteGenres,
                preferredPlatforms,
                playStyle
            }
        });

        this.closeModal(document.getElementById('editProfileModal'));
        this.updateUI();
    }

    showAddFriendModal() {
        document.getElementById('addFriendModal').style.display = 'block';
    }

    sendFriendRequest() {
        const username = document.getElementById('friendUsername').value;
        if (!username) {
            alert('Please enter a username');
            return;
        }

        const friendsList = this.profileManager.getFriendsList();
        if (friendsList) {
            friendsList.sendFriendRequest(`user_${Date.now()}`, username);
            this.closeModal(document.getElementById('addFriendModal'));
            this.updateFriends();
        }
    }

    removeFriend(username) {
        const friendsList = this.profileManager.getFriendsList();
        if (friendsList) {
            friendsList.removeFriend(`user_${username}`);
            this.updateFriends();
        }
    }

    acceptFriendRequest(userId) {
        const friendsList = this.profileManager.getFriendsList();
        if (friendsList) {
            friendsList.acceptFriendRequest(userId);
            this.updateFriends();
        }
    }

    showCreateWishlistModal() {
        document.getElementById('createWishlistModal').style.display = 'block';
    }

    createWishlist() {
        const name = document.getElementById('wishlistName').value;
        const description = document.getElementById('wishlistDescription').value;

        if (!name) {
            alert('Please enter a wishlist name');
            return;
        }

        const wishlistManager = this.profileManager.getWishlistManager();
        if (wishlistManager) {
            wishlistManager.createWishlist(name, description);
            this.closeModal(document.getElementById('createWishlistModal'));
            this.updateWishlists();
        }
    }

    selectWishlist(wishlistId) {
        const wishlistManager = this.profileManager.getWishlistManager();
        if (wishlistManager) {
            const games = wishlistManager.getWishlistGames(wishlistId);
            const container = document.getElementById('wishlistGames');
            const title = document.getElementById('selectedWishlistTitle');
            
            const wishlist = wishlistManager.wishlists.find(w => w.id === wishlistId);
            title.textContent = wishlist ? wishlist.name : 'Select a Wishlist';

            container.innerHTML = '';

            if (games.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><h3>No Games</h3><p>Add some games to this wishlist!</p></div>';
                return;
            }

            games.forEach(game => {
                const gameItem = document.createElement('div');
                gameItem.className = 'friend-item';
                gameItem.innerHTML = `
                    <div>
                        <strong>${game.title}</strong>
                        <br>
                        <small>${game.platform} • Added: ${new Date(game.addedDate).toLocaleDateString()}</small>
                    </div>
                    <button class="btn btn-danger" onclick="app.removeFromWishlist(${wishlistId}, ${game.id})">Remove</button>
                `;
                container.appendChild(gameItem);
            });
        }
    }

    removeFromWishlist(wishlistId, gameId) {
        const wishlistManager = this.profileManager.getWishlistManager();
        if (wishlistManager) {
            wishlistManager.removeGameFromWishlist(wishlistId, gameId);
            this.selectWishlist(wishlistId);
        }
    }

    showAddReviewModal() {
        document.getElementById('addReviewModal').style.display = 'block';
    }

    addReview() {
        const gameTitle = document.getElementById('reviewGameTitle').value;
        const rating = parseInt(document.getElementById('reviewRating').value);
        const reviewText = document.getElementById('reviewText').value;
        const tags = document.getElementById('reviewTags').value.split(',').map(t => t.trim()).filter(t => t);

        if (!gameTitle || !reviewText) {
            alert('Please fill in all required fields');
            return;
        }

        const reviewManager = this.profileManager.getReviewManager();
        if (reviewManager) {
            reviewManager.addReview(`game_${Date.now()}`, gameTitle, rating, reviewText, tags);
            this.closeModal(document.getElementById('addReviewModal'));
            this.updateReviews();
        }
    }

    deleteReview(reviewId) {
        const reviewManager = this.profileManager.getReviewManager();
        if (reviewManager) {
            reviewManager.deleteReview(reviewId);
            this.updateReviews();
        }
    }

    showAdminLoginModal() {
        document.getElementById('adminLoginModal').style.display = 'block';
    }

    handleAdminLogin() {
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;

        if (!username || !password) {
            alert('Please fill in all fields');
            return;
        }

        const admin = this.adminManager.adminLogin(username, password);
        if (admin) {
            this.closeModal(document.getElementById('adminLoginModal'));
            this.updateAdminPanel();
        } else {
            alert('Invalid admin credentials');
        }
    }

    updateAdminPanel() {
        const stats = this.adminManager.getUserStatistics(this.profileManager);
        const container = document.getElementById('adminStats');
        
        container.innerHTML = `
            <div class="stat-card">
                <i class="fas fa-users"></i>
                <h3>${stats.totalUsers}</h3>
                <p>Total Users</p>
            </div>
            <div class="stat-card">
                <i class="fas fa-user-check"></i>
                <h3>${stats.activeUsers}</h3>
                <p>Active Users</p>
            </div>
            <div class="stat-card">
                <i class="fas fa-user-plus"></i>
                <h3>${stats.newUsersThisMonth}</h3>
                <p>New This Month</p>
            </div>
        `;

        const logs = this.adminManager.getSystemLogs();
        const logsContainer = document.getElementById('systemLogs');
        
        logsContainer.innerHTML = '';
        logs.slice(-10).reverse().forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = 'log-item';
            logItem.innerHTML = `
                <strong>${log.action}</strong>: ${log.details}
                <br>
                <small>${new Date(log.timestamp).toLocaleString()}</small>
            `;
            logsContainer.appendChild(logItem);
        });
    }
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GameVaultApp();
});
