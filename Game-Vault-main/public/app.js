// Global search functions - defined immediately
window.performSearch = function() {
    console.log('Global performSearch called');
    const query = document.getElementById("gameSearchInput").value.trim();
    console.log('Search query from global function:', query);
    
    if (!query) {
        alert('Please enter a search term');
        return;
    }
    
    console.log('Redirecting to search page with query:', query);
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
};

window.testSearch = function() {
    console.log('Testing search function...');
    if (window.app && window.app.performGameSearch) {
        window.app.performGameSearch();
    } else {
        console.error('App or performGameSearch method not found');
    }
};

// Login Screen Component
class LoginScreen {
    constructor() {
        this.modal = document.getElementById('authModal');
        this.title = document.getElementById('authTitle');
        this.loginForm = document.getElementById('loginForm');
        this.signupForm = document.getElementById('signupForm');
    }

    show() {
        console.log('LoginScreen.show() called');
        console.log('Modal element:', this.modal);
        this.modal.style.display = 'block';
        console.log('Modal should now be visible');
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
        this.setupSearchListeners(); // Set up search listeners separately
        this.resetUI(); // Initialize UI state
        this.checkAuthStatus(); // Check if user is already logged in
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        // Auth Modal
        const showSignup = document.getElementById('showSignup');
        if (showSignup) {
            showSignup.addEventListener('click', (e) => {
                e.preventDefault();
                this.loginScreen.showSignupForm();
            });
        }

        const showLogin = document.getElementById('showLogin');
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.loginScreen.showLoginForm();
            });
        }

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.handleLogin();
            });
        }

        const signupBtn = document.getElementById('signupBtn');
        if (signupBtn) {
            signupBtn.addEventListener('click', () => {
                this.handleSignup();
            });
        }

        const guestBtnLogin = document.getElementById('guestBtnLogin');
        if (guestBtnLogin) {
            guestBtnLogin.addEventListener('click', () => {
                this.handleGuestLogin();
            });
        }

        // Sign In Button (in header)
        const signInBtn = document.getElementById('signInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => {
                this.loginScreen.show();
                this.loginScreen.resetToInitialState();
            });
        }

        // Profile
        const editProfileBtn = document.getElementById('editProfileBtn');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => {
                this.showEditProfileModal();
            });
        }

        const saveProfileBtn = document.getElementById('saveProfileBtn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', () => {
                this.saveProfile();
            });
        }

        // Friends
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', () => {
                this.showAddFriendModal();
            });
        }

        const sendFriendRequestBtn = document.getElementById('sendFriendRequestBtn');
        if (sendFriendRequestBtn) {
            sendFriendRequestBtn.addEventListener('click', () => {
                this.sendFriendRequest();
            });
        }

        // Wishlist
        const createWishlistBtn = document.getElementById('createWishlistBtn');
        if (createWishlistBtn) {
            createWishlistBtn.addEventListener('click', () => {
                this.showCreateWishlistModal();
            });
        }

        const createWishlistConfirmBtn = document.getElementById('createWishlistConfirmBtn');
        if (createWishlistConfirmBtn) {
            createWishlistConfirmBtn.addEventListener('click', () => {
                this.createWishlist();
            });
        }

        // Reviews
        const addReviewBtn = document.getElementById('addReviewBtn');
        if (addReviewBtn) {
            addReviewBtn.addEventListener('click', () => {
                this.showAddReviewModal();
            });
        }

        const addReviewConfirmBtn = document.getElementById('addReviewConfirmBtn');
        if (addReviewConfirmBtn) {
            addReviewConfirmBtn.addEventListener('click', () => {
                this.addReview();
            });
        }

        // Admin
        const adminLoginBtn = document.getElementById('adminLoginBtn');
        if (adminLoginBtn) {
            adminLoginBtn.addEventListener('click', () => {
                this.showAdminLoginModal();
            });
        }

        const adminLoginConfirmBtn = document.getElementById('adminLoginConfirmBtn');
        if (adminLoginConfirmBtn) {
            adminLoginConfirmBtn.addEventListener('click', () => {
                this.handleAdminLogin();
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        // Login button for guests (in profile)
        const loginBtnProfile = document.getElementById('loginBtnProfile');
        if (loginBtnProfile) {
            loginBtnProfile.addEventListener('click', () => {
                this.showLoginModal();
            });
        }

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

    setupSearchListeners() {
        // Wait a bit for DOM to be fully ready
        setTimeout(() => {
            // Search button event listener
            const searchBtn = document.getElementById("gameSearchBtn");
            const searchInput = document.getElementById("gameSearchInput");
            
            console.log('Setting up search listeners...');
            console.log('Search button element:', searchBtn);
            console.log('Search input element:', searchInput);
            
            if (searchBtn) {
                searchBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    console.log('Search button clicked!');
                    this.performGameSearch();
                });
                console.log('Search button listener added');
            } else {
                console.error('Search button not found!');
            }

            // Also search on Enter key press
            if (searchInput) {
                searchInput.addEventListener("keypress", (e) => {
                    console.log('Key pressed:', e.key);
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        console.log('Enter key pressed!');
                        this.performGameSearch();
                    }
                });
                console.log('Search input listener added');
            } else {
                console.error('Search input not found!');
            }
        }, 100);
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
            credentials: 'include', // Important: include cookies
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
            credentials: 'include', // Important: include cookies
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

    async checkAuthStatus() {
        try {
            console.log('Checking auth status...');
            console.log('Current URL:', window.location.href);
            console.log('Document cookies:', document.cookie);
            
            const response = await fetch('/api/auth/check', {
                credentials: 'include', // Important: include cookies
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Auth check response status:', response.status);
            console.log('Auth check response headers:', response.headers);
            
            const data = await response.json();
            console.log('Auth check response data:', data);
            
            if (data.success && data.user) {
                this.currentUser = data.user;
                this.updateUI();
                console.log('User already logged in:', data.user.username);
                // Hide login screen if user is logged in
                this.loginScreen.hide();
            } else {
                console.log('No active session found');
                // Only show login modal on the home page, not on every page
                if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                    console.log('On home page, showing login screen');
                    this.loginScreen.show();
                    this.loginScreen.resetToInitialState();
                }
                // Show sign-in button in header
                this.showSignInButton();
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            // Only show login modal on home page even on error
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                this.loginScreen.show();
                this.loginScreen.resetToInitialState();
            }
            // Show sign-in button in header
            this.showSignInButton();
        }
    }

    async handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include' // Important: include cookies
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear current user
                this.currentUser = null;
                
                // Reset UI elements
                this.resetUI();
                
                // Show login screen in initial state
                this.loginScreen.show();
                this.loginScreen.resetToInitialState();
                
                console.log('User logged out successfully');
            } else {
                console.error('Logout failed:', data.error);
            }
        } catch (error) {
            console.error('Error during logout:', error);
            // Still clear local state even if server logout fails
            this.currentUser = null;
            this.resetUI();
            this.loginScreen.show();
            this.loginScreen.resetToInitialState();
        }
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
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
        
        const loginBtnProfile = document.getElementById('loginBtnProfile');
        if (loginBtnProfile) {
            loginBtnProfile.style.display = 'none';
        }
        
        // Reset profile info
        const profileUsername = document.getElementById('profileUsername');
        if (profileUsername) {
            profileUsername.textContent = 'Username';
        }
        
        const profileEmail = document.getElementById('profileEmail');
        if (profileEmail) {
            profileEmail.textContent = 'email@example.com';
        }
        
        const profileJoinDate = document.getElementById('profileJoinDate');
        if (profileJoinDate) {
            profileJoinDate.textContent = 'Joined: Loading...';
        }
    }

    updateUI() {
        if (!this.currentUser) {
            this.resetUI();
            return;
        }

        // Show appropriate buttons based on user type
        const logoutBtn = document.getElementById('logoutBtn');
        const loginBtnProfile = document.getElementById('loginBtnProfile');
        
        if (this.currentUser.isGuest) {
            // Guest user - show login button, hide logout
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (loginBtnProfile) loginBtnProfile.style.display = 'inline-block';
        } else {
            // Registered user - show logout button, hide login
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (loginBtnProfile) loginBtnProfile.style.display = 'none';
        }

        // Update profile section
        const profileUsername = document.getElementById('profileUsername');
        if (profileUsername) {
            const capitalizedUsername = this.currentUser.username.toUpperCase();
            profileUsername.textContent = capitalizedUsername;
        }
        
        const profileEmail = document.getElementById('profileEmail');
        if (profileEmail) {
            profileEmail.textContent = this.currentUser.email || 'Guest Account';
        }
        
        const profileJoinDate = document.getElementById('profileJoinDate');
        if (profileJoinDate) {
            profileJoinDate.textContent = this.currentUser.isGuest ? 'Guest Session' : `Joined: ${new Date(this.currentUser.joinDate).toLocaleDateString()}`;
        }
        
        const profileBio = document.getElementById('profileBio');
        if (profileBio) {
            profileBio.textContent = this.currentUser.isGuest ? 'Guest users cannot save data permanently' : (this.currentUser.bio || 'No bio set');
            profileBio.className = this.currentUser.bio ? 'detail-value' : 'detail-value empty';
        }
        
        // Update statistics
        const totalGames = document.getElementById('totalGames');
        if (totalGames) {
            totalGames.textContent = this.currentUser.statistics.totalGamesPlayed;
        }
        
        const totalPlaytime = document.getElementById('totalPlaytime');
        if (totalPlaytime) {
            totalPlaytime.textContent = this.currentUser.statistics.totalPlaytime;
        }
        
        const avgRating = document.getElementById('avgRating');
        if (avgRating) {
            avgRating.textContent = this.currentUser.statistics.averageRating;
        }
        
        const achievementCount = document.getElementById('achievementCount');
        if (achievementCount) {
            achievementCount.textContent = this.currentUser.achievements.length;
        }

        // Update gaming preferences
        const playStyleDisplay = document.getElementById('playStyleDisplay');
        if (playStyleDisplay) {
            const playStyle = this.currentUser.gamingPreferences.playStyle || 'Not specified';
            const capitalizedPlayStyle = playStyle === 'Not specified' ? playStyle : playStyle.charAt(0).toUpperCase() + playStyle.slice(1);
            playStyleDisplay.textContent = capitalizedPlayStyle;
            playStyleDisplay.className = playStyle !== 'Not specified' ? 'detail-value' : 'detail-value empty';
        }
        
        const favoriteGenresDisplay = document.getElementById('favoriteGenresDisplay');
        if (favoriteGenresDisplay) {
            const genres = this.currentUser.gamingPreferences.favoriteGenres || [];
            const genresText = genres.length > 0 ? genres.join(', ') : 'None set';
            favoriteGenresDisplay.textContent = genresText;
            favoriteGenresDisplay.className = genres.length > 0 ? 'detail-value' : 'detail-value empty';
        }
        
        const preferredPlatformsDisplay = document.getElementById('preferredPlatformsDisplay');
        if (preferredPlatformsDisplay) {
            const platforms = this.currentUser.gamingPreferences.preferredPlatforms || [];
            const platformsText = platforms.length > 0 ? platforms.join(', ') : 'None set';
            preferredPlatformsDisplay.textContent = platformsText;
            preferredPlatformsDisplay.className = platforms.length > 0 ? 'detail-value' : 'detail-value empty';
        }

        // Update achievements
        this.updateAchievements();

        // Update friends
        this.updateFriends();

        // Update wishlists
        this.updateWishlists();

        // Update reviews
        this.updateReviews();
        
        // Hide sign-in button when user is logged in
        this.hideSignInButton();
    }

    showSignInButton() {
        console.log('showSignInButton called');
        const authSection = document.getElementById('authSection');
        console.log('authSection element:', authSection);
        if (authSection) {
            authSection.style.display = 'block';
            console.log('Sign-in button should now be visible');
        } else {
            console.error('authSection element not found!');
        }
    }

    hideSignInButton() {
        const authSection = document.getElementById('authSection');
        if (authSection) {
            authSection.style.display = 'none';
        }
    }

    updateAchievements() {
        const container = document.getElementById('achievementsList');
        if (!container) {
            return; // Element not found, skip update
        }
        
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
        const container = document.getElementById('wishlistContainer');
        if (!container) {
            return; // Element not found, skip update
        }
        
        if (!this.currentUser) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><h3>Login Required</h3><p>Please log in to view your wishlist!</p></div>';
            return;
        }

        // Call the server API to get wishlists
        fetch(`/api/wishlists/${this.currentUser.username}`)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('wishlistContainer');
            if (!container) {
                return; // Element not found, skip update
            }
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
        const container = document.getElementById('reviewsContainer');
        if (!container) {
            return; // Element not found, skip update
        }
        
        if (!this.currentUser) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><h3>Login Required</h3><p>Please log in to view your reviews!</p></div>';
            return;
        }

        // Call the server API to get reviews
        fetch(`/api/reviews/${this.currentUser.username}`)
        .then(response => response.json())
        .then(data => {
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

        const editProfileModal = document.getElementById('editProfileModal');
        if (editProfileModal) {
            editProfileModal.style.display = 'block';
        }
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
        const addFriendModal = document.getElementById('addFriendModal');
        if (addFriendModal) {
            addFriendModal.style.display = 'block';
        }
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
        const createWishlistModal = document.getElementById('createWishlistModal');
        if (createWishlistModal) {
            createWishlistModal.style.display = 'block';
        }
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
        const addReviewModal = document.getElementById('addReviewModal');
        if (addReviewModal) {
            addReviewModal.style.display = 'block';
        }
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
        const adminLoginModal = document.getElementById('adminLoginModal');
        if (adminLoginModal) {
            adminLoginModal.style.display = 'block';
        }
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

    // Game Search Methods
    performGameSearch() {
        console.log('performGameSearch called');
        const searchInput = document.getElementById("gameSearchInput");
        console.log('Search input element:', searchInput);
        
        if (!searchInput) {
            console.error('Search input not found in performGameSearch!');
            alert('Search input not found');
            return;
        }
        
        const query = searchInput.value.trim();
        console.log('Search query:', query);
        
        if (!query) {
            alert('Please enter a search term');
            return;
        }

        console.log('Redirecting to search page with query:', query);
        // Redirect to search page with query parameter
        window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }

    async searchGames(query, page = 1) {
        try {
            // Show loading state
            this.showSearchLoading();

            console.log('Searching for:', query);
            const response = await fetch(`/api/games/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=20`);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Search response:', data);

            if (data.success) {
                this.displaySearchResults(data.games, data.totalResults, data.currentPage, data.totalPages, query);
            } else {
                this.showSearchError(data.error || 'Failed to search games');
            }
        } catch (error) {
            console.error('Error searching games:', error);
            this.showSearchError(`Network error: ${error.message}. Please try again.`);
        }
    }

    showSearchResults() {
        console.log('showSearchResults called');
        // Create search results modal if it doesn't exist
        let searchModal = document.getElementById('searchResultsModal');
        if (!searchModal) {
            console.log('Creating new search modal');
            searchModal = document.createElement('div');
            searchModal.id = 'searchResultsModal';
            searchModal.className = 'modal';
            searchModal.innerHTML = `
                <div class="modal-content search-modal-content">
                    <div class="search-header">
                        <h2 id="searchTitle">Search Results</h2>
                        <span class="close" onclick="app.closeSearchModal()">&times;</span>
                    </div>
                    <div id="searchContent">
                        <div id="searchLoading" class="search-loading" style="display: none;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Searching games...</p>
                        </div>
                        <div id="searchError" class="search-error" style="display: none;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p id="searchErrorMessage"></p>
                        </div>
                        <div id="searchResults" class="search-results"></div>
                        <div id="searchPagination" class="search-pagination"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(searchModal);
            console.log('Search modal created and added to DOM');
        }

        console.log('Showing search modal');
        searchModal.style.display = 'block';
    }

    closeSearchModal() {
        const searchModal = document.getElementById('searchResultsModal');
        if (searchModal) {
            searchModal.style.display = 'none';
        }
    }

    showSearchLoading() {
        const searchLoading = document.getElementById('searchLoading');
        const searchError = document.getElementById('searchError');
        const searchResults = document.getElementById('searchResults');
        const searchPagination = document.getElementById('searchPagination');
        
        if (searchLoading) searchLoading.style.display = 'block';
        if (searchError) searchError.style.display = 'none';
        if (searchResults) searchResults.style.display = 'none';
        if (searchPagination) searchPagination.style.display = 'none';
    }

    showSearchError(message) {
        const searchLoading = document.getElementById('searchLoading');
        const searchError = document.getElementById('searchError');
        const searchErrorMessage = document.getElementById('searchErrorMessage');
        const searchResults = document.getElementById('searchResults');
        const searchPagination = document.getElementById('searchPagination');
        
        if (searchLoading) searchLoading.style.display = 'none';
        if (searchError) searchError.style.display = 'block';
        if (searchErrorMessage) searchErrorMessage.textContent = message;
        if (searchResults) searchResults.style.display = 'none';
        if (searchPagination) searchPagination.style.display = 'none';
    }

    displaySearchResults(games, totalResults, currentPage, totalPages, query) {
        const searchLoading = document.getElementById('searchLoading');
        const searchError = document.getElementById('searchError');
        const searchResults = document.getElementById('searchResults');
        const searchPagination = document.getElementById('searchPagination');
        
        if (searchLoading) searchLoading.style.display = 'none';
        if (searchError) searchError.style.display = 'none';
        if (searchResults) searchResults.style.display = 'block';
        if (searchPagination) searchPagination.style.display = 'block';

        // Update title
        document.getElementById('searchTitle').textContent = `Search Results for "${query}" (${totalResults} games found)`;

        // Display games
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';

        if (games.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No Games Found</h3>
                    <p>Try a different search term</p>
                </div>
            `;
            return;
        }

        // Add notice for mock data
        const mockDataNotice = document.createElement('div');
        mockDataNotice.className = 'mock-data-notice';
        mockDataNotice.innerHTML = `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #856404;">
                <i class="fas fa-info-circle"></i>
                <strong>Demo Mode:</strong> This is sample data. To search real games, configure your RAWG.io API key in the .env file.
                <a href="https://rawg.io/apidocs" target="_blank" style="color: #007bff; text-decoration: underline;">Get API Key</a>
            </div>
        `;
        resultsContainer.appendChild(mockDataNotice);

        games.forEach(game => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            
            // Steam ownership badge
            const steamBadge = game.steamOwned ? '<span class="steam-game-badge"><i class="fab fa-steam"></i> Owned on Steam</span>' : '';
            
            gameCard.innerHTML = `
                <div class="game-image">
                    ${game.backgroundImage ? 
                        `<img src="${game.backgroundImage}" alt="${game.name}" onerror="this.style.display='none'">` : 
                        '<div class="no-image"><i class="fas fa-gamepad"></i></div>'
                    }
                    ${steamBadge}
                </div>
                <div class="game-info">
                    <h3 class="game-title">${game.name}</h3>
                    <div class="game-meta">
                        ${game.released ? `<span class="release-date"><i class="fas fa-calendar"></i> ${new Date(game.released).getFullYear()}</span>` : ''}
                        ${game.rating ? `<span class="rating"><i class="fas fa-star"></i> ${game.rating.toFixed(1)}</span>` : ''}
                        ${game.metacritic ? `<span class="metacritic">Metacritic: ${game.metacritic}</span>` : ''}
                    </div>
                    <div class="game-platforms">
                        ${game.platforms.slice(0, 3).map(platform => 
                            `<span class="platform-tag">${platform.name}</span>`
                        ).join('')}
                        ${game.platforms.length > 3 ? `<span class="platform-tag">+${game.platforms.length - 3} more</span>` : ''}
                    </div>
                    <div class="game-genres">
                        ${game.genres.slice(0, 3).map(genre => 
                            `<span class="genre-tag">${genre.name}</span>`
                        ).join('')}
                    </div>
                    <div class="game-actions">
                        <button class="btn btn-primary" onclick="app.viewGameDetails(${game.id})">
                            <i class="fas fa-info-circle"></i> View Details
                        </button>
                        ${game.steamOwned ? 
                            `<a href="steam://run/${game.id}" class="btn btn-steam">
                                <i class="fab fa-steam"></i> Play on Steam
                            </a>` : 
                            `<button class="btn btn-secondary" onclick="app.addToWishlist(${game.id}, '${game.name}')">
                                <i class="fas fa-heart"></i> Add to Wishlist
                            </button>`
                        }
                    </div>
                </div>
            `;
            resultsContainer.appendChild(gameCard);
        });

        // Display pagination
        this.displaySearchPagination(currentPage, totalPages, query);
    }

    displaySearchPagination(currentPage, totalPages, query) {
        const paginationContainer = document.getElementById('searchPagination');
        paginationContainer.innerHTML = '';

        if (totalPages <= 1) return;

        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        // Previous button
        if (currentPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn btn-secondary';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
            prevBtn.onclick = () => this.searchGames(query, currentPage - 1);
            pagination.appendChild(prevBtn);
        }

        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => this.searchGames(query, i);
            pagination.appendChild(pageBtn);
        }

        // Next button
        if (currentPage < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-secondary';
            nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
            nextBtn.onclick = () => this.searchGames(query, currentPage + 1);
            pagination.appendChild(nextBtn);
        }

        paginationContainer.appendChild(pagination);
    }

    viewGameDetails(gameId) {
        // This would open a detailed view of the game
        // For now, we'll just show an alert with the game ID
        alert(`Viewing details for game ID: ${gameId}`);
        // You can implement a detailed game view modal here
    }

    async addToWishlist(gameId, gameName) {
        if (!this.currentUser) {
            alert('Please log in to add games to your wishlist');
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/add-game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gameId: gameId,
                    gameName: gameName,
                    gameData: {
                        addedDate: new Date().toISOString()
                    }
                })
            });

            const result = await response.json();

            if (result.success) {
                alert(`Added "${gameName}" to wishlist!`);
            } else {
                alert('Failed to add game to wishlist: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding game to wishlist:', error);
            alert('Error adding game to wishlist');
        }
    }
}


// Steam Integration Functions
class SteamIntegration {
    constructor() {
        this.steamLinked = false;
        this.steamProfile = null;
    }

    async initializeSteamIntegration() {
        try {
            // Get username from URL
            const username = this.getUsernameFromUrl();
            if (!username) {
                console.error('Username not found in URL');
                return;
            }
            
            // Check Steam link status
            const response = await fetch(`/api/auth/steam/status/${username}`);
            const status = await response.json();
            
            if (status.linked) {
                this.steamLinked = true;
                this.steamProfile = status.steam_profile;
                this.showSteamProfile();
                this.loadSteamGames();
                
                // Check if Steam auth just completed and auto-import library
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('steam_auth') === 'success') {
                    // Remove the parameter from URL
                    const newUrl = window.location.pathname + window.location.search.replace(/[?&]steam_auth=success/, '');
                    window.history.replaceState({}, '', newUrl);
                    
                    // Auto-import Steam library
                    console.log('Steam auth completed, auto-importing library...');
                    await this.importSteamLibrary();
                }
            } else {
                this.showSteamConnect();
            }
        } catch (error) {
            console.error('Error checking Steam status:', error);
        }
    }

    showSteamProfile() {
        const steamProfileSection = document.getElementById('steamProfileSection');
        const steamConnectSection = document.getElementById('steamConnectSection');
        
        if (steamProfileSection && steamConnectSection) {
            steamProfileSection.style.display = 'block';
            steamConnectSection.style.display = 'none';
            
            // Update Steam profile info
            if (this.steamProfile) {
                const steamAvatar = document.getElementById('steamAvatar');
                const steamUsername = document.getElementById('steamUsername');
                const steamProfileUrl = document.getElementById('steamProfileUrl');
                
                if (steamAvatar) steamAvatar.src = this.steamProfile.avatarfull || this.steamProfile.avatar;
                if (steamUsername) steamUsername.textContent = this.steamProfile.personaname || 'Steam User';
                if (steamProfileUrl) steamProfileUrl.innerHTML = `<a href="${this.steamProfile.profileurl}" target="_blank">View Steam Profile</a>`;
            }
        }
    }

    showSteamConnect() {
        const steamProfileSection = document.getElementById('steamProfileSection');
        const steamConnectSection = document.getElementById('steamConnectSection');
        
        if (steamProfileSection && steamConnectSection) {
            steamProfileSection.style.display = 'none';
            steamConnectSection.style.display = 'block';
        }
    }

    async connectSteam() {
        try {
            // Get username from URL
            const username = this.getUsernameFromUrl();
            if (!username) {
                alert('Username not found in URL');
                return;
            }
            
            // Store current page URL for redirect after Steam auth
            const currentUrl = window.location.pathname + window.location.search;
            sessionStorage.setItem('preSteamUrl', currentUrl);
            
            const response = await fetch(`/api/auth/steam/link/${username}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    returnUrl: currentUrl
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Redirect to Steam OAuth
                window.location.href = result.redirectUrl;
            } else {
                alert('Failed to connect Steam account: ' + result.error);
            }
        } catch (error) {
            console.error('Error connecting Steam:', error);
            alert('Error connecting Steam account');
        }
    }

    async disconnectSteam() {
        if (!confirm('Are you sure you want to disconnect your Steam account?')) {
            return;
        }

        try {
            // Get username from URL
            const username = this.getUsernameFromUrl();
            if (!username) {
                alert('Username not found in URL');
                return;
            }
            
            const response = await fetch(`/api/auth/steam/unlink/${username}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.steamLinked = false;
                this.steamProfile = null;
                this.showSteamConnect();
                alert('Steam account disconnected successfully');
            } else {
                alert('Failed to disconnect Steam account: ' + result.error);
            }
        } catch (error) {
            console.error('Error disconnecting Steam:', error);
            alert('Error disconnecting Steam account');
        }
    }

    async importSteamLibrary() {
        try {
            console.log('Importing Steam library...');
            
            // Get username from URL
            const username = this.getUsernameFromUrl();
            if (!username) {
                alert('Username not found in URL');
                return;
            }
            
            const response = await fetch(`/api/steam/sync/${username}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Import response status:', response.status);
            const result = await response.json();
            console.log('Import result:', result);
            
            if (result.success) {
                const gamesCount = result.gamesCount || 0;
                alert(`Successfully imported ${gamesCount} games from Steam!`);
                // Stay on the profile page and reload to show updated stats
                const currentUrl = window.location.href;
                window.location.href = currentUrl;
            } else {
                alert('Failed to import Steam library: ' + result.error);
            }
        } catch (error) {
            console.error('Error importing Steam library:', error);
            alert('Error importing Steam library: ' + error.message);
        }
    }

    getUsernameFromUrl() {
        // Extract username from URL path like /profile/username
        const pathParts = window.location.pathname.split('/');
        const profileIndex = pathParts.indexOf('profile');
        if (profileIndex !== -1 && pathParts[profileIndex + 1]) {
            return pathParts[profileIndex + 1];
        }
        return null;
    }

    async loadSteamGames() {
        try {
            // Get username from URL
            const username = this.getUsernameFromUrl();
            if (!username) {
                console.error('Username not found in URL');
                return;
            }
            
            const response = await fetch(`/api/steam/games/${username}`);
            const result = await response.json();
            
            if (result.success) {
                // Update Steam profile section
                const steamGameCount = document.getElementById('steamGameCount');
                if (steamGameCount) {
                    steamGameCount.textContent = result.games ? result.games.length : 0;
                }

                // Calculate Steam statistics
                let totalPlaytime = 0;
                let totalAchievements = 0;
                
                if (result.games && result.games.length > 0) {
                    totalPlaytime = result.games.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
                    // Calculate achievements the same way as games and hours
                    totalAchievements = result.games.reduce((sum, game) => sum + (game.achievements || 0), 0);
                }

                // Update main profile stats with Steam data
                const totalGames = document.getElementById('totalGames');
                const totalPlaytimeElement = document.getElementById('totalPlaytime');
                const achievementCount = document.getElementById('achievementCount');
                
                if (totalGames) {
                    totalGames.textContent = result.games ? result.games.length : 0;
                }
                if (totalPlaytimeElement) {
                    totalPlaytimeElement.textContent = Math.round(totalPlaytime / 60); // Convert minutes to hours
                }
                if (achievementCount) {
                    achievementCount.textContent = totalAchievements;
                }

                // Load site-based ratings (user's game ratings from the site)
                await this.loadSiteRatings();
            }
        } catch (error) {
            console.error('Error loading Steam games:', error);
        }
    }


    async loadSiteRatings() {
        try {
            // Get user's reviews/ratings from the site
            const response = await fetch('/api/reviews/current-user');
            const result = await response.json();
            
            if (result.success && result.reviews) {
                // Calculate average rating from user's reviews
                const ratings = result.reviews.filter(review => review.rating > 0).map(review => review.rating);
                const avgRating = ratings.length > 0 ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 0;
                
                // Update the average rating in the stats
                const avgRatingElement = document.getElementById('avgRating');
                if (avgRatingElement) {
                    avgRatingElement.textContent = avgRating;
                }
            }
        } catch (error) {
            console.error('Error loading site ratings:', error);
        }
    }

    async checkWishlistSteamOwnership(username) {
        try {
            const response = await fetch(`/api/wishlists/${username}/steam-check`);
            const result = await response.json();
            
            if (result.success) {
                return {
                    steamOwnedGames: result.steamOwnedGames,
                    totalOwned: result.totalOwned
                };
            }
            return null;
        } catch (error) {
            console.error('Error checking Steam ownership for wishlist:', error);
            return null;
        }
    }

    generateSteamWishlistLink(gameId) {
        return `https://store.steampowered.com/app/${gameId}/`;
    }
}

// Initialize the app when the page loads
let app;
let steamIntegration;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing GameVaultApp');
    app = new GameVaultApp();
    window.app = app; // Make app available globally
    
    // Initialize Steam integration
    steamIntegration = new SteamIntegration();
    window.steamIntegration = steamIntegration; // Make available globally
    
    // Test if search elements exist after initialization
    setTimeout(() => {
        console.log('Testing search elements after initialization:');
        console.log('Search button:', document.getElementById("gameSearchBtn"));
        console.log('Search input:', document.getElementById("gameSearchInput"));
        console.log('Global functions available:', typeof window.performSearch, typeof window.testSearch);
        
        // Initialize Steam integration after a short delay
        if (steamIntegration) {
            steamIntegration.initializeSteamIntegration();
        }
    }, 500);
});

// Global Steam functions for use in HTML
window.connectSteam = function() {
    if (steamIntegration) {
        steamIntegration.connectSteam();
    }
};

window.disconnectSteam = function() {
    if (steamIntegration) {
        steamIntegration.disconnectSteam();
    }
};

window.importSteamLibrary = function() {
    if (steamIntegration) {
        steamIntegration.importSteamLibrary();
    }
};

window.checkWishlistSteamOwnership = function(username) {
    if (steamIntegration) {
        return steamIntegration.checkWishlistSteamOwnership(username);
    }
    return null;
};

window.generateSteamWishlistLink = function(gameId) {
    if (steamIntegration) {
        return steamIntegration.generateSteamWishlistLink(gameId);
    }
    return `https://store.steampowered.com/app/${gameId}/`;
};
