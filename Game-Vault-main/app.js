// Login Screen Component
class LoginScreen {
    constructor() {
        this.modal = document.getElementById('authModal');
        this.title = document.getElementById('authTitle');
        this.loginForm = document.getElementById('loginForm');
        this.signupForm = document.getElementById('signupForm');
    }

    show() {
        this.modal.style.display = 'block';
    }

    hide() {
        this.modal.style.display = 'none';
    }

    resetToInitialState() {
        // Reset to exact initial state
        this.title.textContent = 'Welcome to Game Vault';
        this.loginForm.style.display = 'block';
        this.signupForm.style.display = 'none';
        
        // Clear all form fields
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('signupUsername').value = '';
        document.getElementById('signupEmail').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('playStyle').value = 'casual';
        document.getElementById('favoriteGenres').value = '';
        document.getElementById('preferredPlatforms').value = '';
    }

    showLoginForm() {
        this.loginForm.style.display = 'block';
        this.signupForm.style.display = 'none';
        this.title.textContent = 'Login to Game Vault';
    }

    showSignupForm() {
        this.loginForm.style.display = 'none';
        this.signupForm.style.display = 'block';
        this.title.textContent = 'Join Game Vault';
    }
}

// Web Application JavaScript
class GameVaultApp {
    constructor() {
        this.loginScreen = new LoginScreen();
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.resetUI(); // Initialize UI state
        this.loginScreen.show();
        this.loginScreen.resetToInitialState();
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
            this.loginScreen.showSignupForm();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.loginScreen.showLoginForm();
        });

        document.getElementById('loginBtn').addEventListener('click', () => {
            this.handleLogin();
        });

        document.getElementById('signupBtn').addEventListener('click', () => {
            this.handleSignup();
        });

        document.getElementById('guestBtn').addEventListener('click', () => {
            this.handleGuestLogin();
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
        document.getElementById("gameSearchBtn").addEventListener("click", () => {
            const query = document.getElementById("gameSearchInput").value.trim().toLowerCase();
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

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Login button for guests (in profile)
        document.getElementById('loginBtnProfile').addEventListener('click', () => {
            this.showLoginModal();
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal && modal.id !== 'authModal') {
                    this.closeModal(modal);
                }
            });
        });

        // Close modal when clicking outside (except auth modal)
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal && modal.id !== 'authModal') {
                    this.closeModal(modal);
                }
            });
        });
    }


    closeModal(modal) {
        modal.style.display = 'none';
    }

    handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            alert('Please fill in all fields');
            return;
        }

        // Call the server API to login
        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                password
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.currentUser = data.user;
                this.loginScreen.hide();
                this.updateUI();
                console.log('User logged in successfully:', data.user.username);
            } else {
                alert(data.error || 'Invalid credentials');
            }
        })
        .catch(error => {
            console.error('Error logging in:', error);
            alert('Error logging in. Please try again.');
        });
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

        // Call the server API to create the user
        fetch('/api/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                email,
                password,
                gamingPreferences
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.currentUser = data.user;
                this.loginScreen.hide();
                this.updateUI();
                console.log('User created successfully on server:', data.user.username);
            } else {
                alert(data.error || 'Failed to create account');
            }
        })
        .catch(error => {
            console.error('Error creating account:', error);
            alert('Error creating account. Please try again.');
        });
    }

    handleLogout() {
        // Clear current user
        this.currentUser = null;
        
        // Reset UI elements
        this.resetUI();
        
        // Show login screen in initial state
        this.loginScreen.show();
        this.loginScreen.resetToInitialState();
        
        console.log('User logged out successfully');
    }

    showLoginModal() {
        // Show the login modal
        this.loginScreen.show();
        this.loginScreen.resetToInitialState();
    }

    handleGuestLogin() {
        // Create a temporary guest user with no persistence
        this.currentUser = {
            username: 'Guest',
            email: null,
            joinDate: new Date().toISOString(),
            bio: '',
            gamingPreferences: {
                favoriteGenres: [],
                preferredPlatforms: [],
                playStyle: 'casual',
                gamingGoals: []
            },
            statistics: {
                totalGamesPlayed: 0,
                totalPlaytime: 0,
                averageRating: 0,
                favoriteGame: null,
                mostPlayedPlatform: null,
                completionRate: 0,
                totalReviews: 0,
                friendsCount: 0
            },
            achievements: [],
            avatar: null,
            privacySettings: {
                profileVisibility: 'public',
                showEmail: false,
                showStatistics: true,
                showFriendsList: true
            },
            isGuest: true // Flag to identify guest users
        };

        // Hide the login modal
        this.loginScreen.hide();
        
        // Update UI but don't show logout button for guests
        this.updateUI();
        
        console.log('Guest user logged in successfully');
    }

    resetUI() {
        // Hide all action buttons
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('loginBtnProfile').style.display = 'none';
        
        // Reset profile info
        document.getElementById('profileUsername').textContent = 'Username';
        document.getElementById('profileEmail').textContent = 'email@example.com';
        document.getElementById('profileJoinDate').textContent = 'Joined: Loading...';
    }

    updateUI() {
        if (!this.currentUser) {
            this.resetUI();
            return;
        }

        // Show appropriate buttons based on user type
        if (this.currentUser.isGuest) {
            // Guest user - show login button, hide logout
            document.getElementById('logoutBtn').style.display = 'none';
            document.getElementById('loginBtnProfile').style.display = 'inline-block';
        } else {
            // Registered user - show logout button, hide login
            document.getElementById('logoutBtn').style.display = 'inline-block';
            document.getElementById('loginBtnProfile').style.display = 'none';
        }

        // Update profile section
        document.getElementById('profileUsername').textContent = this.currentUser.username;
        document.getElementById('profileEmail').textContent = this.currentUser.email || 'Guest Account';
        document.getElementById('profileJoinDate').textContent = this.currentUser.isGuest ? 'Guest Session' : `Joined: ${new Date(this.currentUser.joinDate).toLocaleDateString()}`;
        document.getElementById('profileBio').textContent = this.currentUser.isGuest ? 'Guest users cannot save data permanently' : (this.currentUser.bio || 'No bio set');
        
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
        if (!this.currentUser) {
            return;
        }

        // Call the server API to get friends list
        fetch(`/api/friends/${this.currentUser.username}`)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('friendsList');
            const friends = data.friends || [];
            const pendingRequests = data.pendingRequests || [];

            container.innerHTML = '';

            if (friends.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h3>No Friends</h3><p>Add some friends to get started!</p></div>';
            } else {
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
            }

            // Update pending requests
            const pendingContainer = document.getElementById('pendingRequests');
            
            if (pendingRequests.length === 0) {
                pendingContainer.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><h3>No Pending Requests</h3></div>';
            } else {
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
        })
        .catch(error => {
            console.error('Error fetching friends:', error);
        });
    }

    updateWishlists() {
        if (!this.currentUser) {
            return;
        }

        // Call the server API to get wishlists
        fetch(`/api/wishlists/${this.currentUser.username}`)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('wishlistsList');
            const wishlists = data.wishlists || [];
            
            container.innerHTML = '';

            if (wishlists.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><h3>No Wishlists</h3><p>Create your first wishlist!</p></div>';
            } else {
                wishlists.forEach(wishlist => {
                    const wishlistItem = document.createElement('div');
                    wishlistItem.className = 'wishlist-item';
                    wishlistItem.innerHTML = `
                        <div>
                            <strong>${wishlist.name}</strong>
                            <br>
                            <small>${wishlist.gameCount || 0} games • Created: ${new Date(wishlist.createdDate).toLocaleDateString()}</small>
                        </div>
                        <button class="btn btn-primary" onclick="app.selectWishlist(${wishlist.id})">View</button>
                    `;
                    container.appendChild(wishlistItem);
                });
            }
        })
        .catch(error => {
            console.error('Error fetching wishlists:', error);
        });
    }

    updateReviews() {
        if (!this.currentUser) {
            return;
        }

        // Call the server API to get reviews
        fetch(`/api/reviews/${this.currentUser.username}`)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('reviewsList');
            const reviews = data.reviews || [];
            const averageRating = data.averageRating || 0;

            document.getElementById('totalReviews').textContent = reviews.length;
            document.getElementById('avgReviewRating').textContent = averageRating;

            container.innerHTML = '';

            if (reviews.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><h3>No Reviews</h3><p>Write your first review!</p></div>';
            } else {
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
        })
        .catch(error => {
            console.error('Error fetching reviews:', error);
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

        const updates = {
            bio,
            gamingPreferences: {
                favoriteGenres,
                preferredPlatforms,
                playStyle
            }
        };

        // Call the server API to update profile
        fetch(`/api/profile/${this.currentUser.username}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update local user data
                this.currentUser.bio = bio;
                this.currentUser.gamingPreferences = updates.gamingPreferences;
                
                this.closeModal(document.getElementById('editProfileModal'));
                this.updateUI();
            } else {
                alert(data.error || 'Failed to update profile');
            }
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            alert('Error updating profile. Please try again.');
        });
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

        // Call the server API to login as admin
        fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                password
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.closeModal(document.getElementById('adminLoginModal'));
                this.updateAdminPanel();
            } else {
                alert(data.error || 'Invalid admin credentials');
            }
        })
        .catch(error => {
            console.error('Error logging in as admin:', error);
            alert('Error logging in as admin. Please try again.');
        });
    }

    updateAdminPanel() {
        // Call the server API to get admin statistics
        fetch('/api/admin/stats')
        .then(response => response.json())
        .then(data => {
            const stats = data.userStats;
            const container = document.getElementById('adminStats');
            
            container.innerHTML = `
                <div class="stat-card">
                    <i class="fas fa-users"></i>
                    <h3>${stats.totalUsers || 0}</h3>
                    <p>Total Users</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-user-check"></i>
                    <h3>${stats.activeUsers || 0}</h3>
                    <p>Active Users</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-user-plus"></i>
                    <h3>${stats.newUsersThisMonth || 0}</h3>
                    <p>New This Month</p>
                </div>
            `;

            const logs = data.systemLogs || [];
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
        })
        .catch(error => {
            console.error('Error fetching admin stats:', error);
        });
    }
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GameVaultApp();
});
