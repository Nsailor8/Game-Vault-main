// Global search functions - defined immediately
window.performSearch = function() {
    console.log('Global performSearch called');
    const query = document.getElementById("gameSearchInput").value.trim();
    console.log('Search query from global function:', query);
    
    if (!query) {
        if (window.app) {
            window.app.showAlert('Please enter a search term', 'Search Required', 'warning');
        } else {
            alert('Please enter a search term');
        }
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

        // Friends (addFriendBtn removed - using inline form instead)

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

        const editReviewConfirmBtn = document.getElementById('editReviewConfirmBtn');
        if (editReviewConfirmBtn) {
            editReviewConfirmBtn.addEventListener('click', () => {
            this.updateReview();
        });
        }

        // Star rating functionality
        this.setupStarRating('starRating', 'reviewRating', 'rating-text');
        this.setupStarRating('editStarRating', 'editRating', 'rating-text');
        
        // Character count functionality
        const reviewText = document.getElementById('reviewText');
        if (reviewText) {
            reviewText.addEventListener('input', () => {
                this.updateCharCount('reviewText', 'charCount');
            });
        }

        const editReviewText = document.getElementById('editReviewText');
        if (editReviewText) {
            editReviewText.addEventListener('input', () => {
                this.updateCharCount('editReviewText', 'editCharCount');
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

        // Friend request event listeners (already declared above)

        // Enter key for friend username input
        const friendUsernameInput = document.getElementById('friendUsernameInput');
        if (friendUsernameInput) {
            friendUsernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendFriendRequest();
                }
            });
        }
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

            // Also search on Enter key press and autocomplete
            if (searchInput) {
                searchInput.addEventListener("keypress", (e) => {
                    console.log('Key pressed:', e.key);
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        console.log('Enter key pressed!');
                        this.performGameSearch();
                    }
                });
                
                // Autocomplete functionality
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.trim();
                    
                    // Clear previous timeout
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    
                    // Hide suggestions if query is too short
                    if (query.length < 2) {
                        this.hideSearchSuggestions();
                        return;
                    }
                    
                    // Debounce the search
                    searchTimeout = setTimeout(() => {
                        this.getSearchSuggestions(query);
                    }, 300);
                });
                
                // Hide suggestions when clicking outside
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.search-wrapper')) {
                        this.hideSearchSuggestions();
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
            this.showAlert('Please fill in all fields', 'Login Required', 'warning');
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
                this.showAlert(data.error || 'Invalid credentials', 'Login Failed', 'error');
            }
        })
        .catch(error => {
            console.error('Error logging in:', error);
            this.showAlert('Error logging in. Please try again.', 'Error', 'error');
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
            this.showAlert('Please fill in all required fields', 'Signup Required', 'warning');
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
                this.showAlert(data.error || 'Failed to create account', 'Signup Failed', 'error');
            }
        })
        .catch(error => {
            console.error('Error creating account:', error);
            this.showAlert('Error creating account. Please try again.', 'Error', 'error');
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
                    app.updateFriends();
    console.log('updateFriends called for', app.currentUser.username);
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
        
        // Show user section when user is logged in
        this.showUserSection();
    }

    showSignInButton() {
        console.log('showSignInButton called');
        const authSection = document.getElementById('authSection');
        const userSection = document.getElementById('userSection');
        console.log('authSection element:', authSection);
        console.log('userSection element:', userSection);
        
        if (authSection) {
            authSection.style.display = 'block';
            console.log('Sign-in button should now be visible');
        } else {
            console.error('authSection element not found!');
        }
        
        if (userSection) {
            userSection.style.display = 'none';
        }
    }

    hideSignInButton() {
        const authSection = document.getElementById('authSection');
        const userSection = document.getElementById('userSection');
        
        if (authSection) {
            authSection.style.display = 'none';
        }
        
        if (userSection) {
            userSection.style.display = 'block';
        }
    }

    showUserSection() {
        const authSection = document.getElementById('authSection');
        const userSection = document.getElementById('userSection');
        const userDisplayName = document.getElementById('userDisplayName');
        
        if (authSection) {
            authSection.style.display = 'none';
        }
        
        if (userSection) {
            userSection.style.display = 'block';
        }
        
        if (userDisplayName && this.currentUser) {
            userDisplayName.textContent = this.currentUser.username;
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

async updateFriends() {
    console.log('updateFriends called');

    try {
        // Fetch friends
        const friends = await this.getFriendsList();
        console.log('Fetched friends:', friends);

        // Display friends using your existing displayFriends function
        if (friends && typeof this.displayFriends === 'function') {
            this.displayFriends(friends);
        } else {
            console.warn('displayFriends function is not defined');
        }
    } catch (error) {
        console.error('Error fetching friends:', error);
    }
}



async viewFriendProfile(friend) {
  // Get modal elements
  const modal = document.getElementById('friendProfileModal');
  const usernameEl = document.getElementById('friendUsername');
  const modalBody = modal.querySelector('.modal-body');

  // Set the username
  usernameEl.textContent = friend.username;

  // Optional: show more info if available
  modalBody.innerHTML = `
    <p>Friend profile will load here.</p>
    <p>Username: ${friend.username}</p>
    <p>Friend since: ${friend.acceptedDate || 'N/A'}</p>
  `;

  // Show the modal
  modal.style.display = 'block';
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
        fetch(`/api/wishlists/${this.currentUser.username}`, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('wishlistContainer');
            if (!container) {
                return; // Element not found, skip update
            }
            
            if (data.success && data.wishlists) {
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
                                ${wishlist.description ? `<br><small style="color: #888;">${wishlist.description}</small>` : ''}
                            </div>
                            <button class="btn btn-primary" onclick="app.selectWishlist(${wishlist.id})">View</button>
                        `;
                        container.appendChild(wishlistItem);
                    });
                }
            } else {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>Failed to load wishlists. Please try again.</p></div>';
            }
        })
        .catch(error => {
            console.error('Error fetching wishlists:', error);
            const container = document.getElementById('wishlistContainer');
            if (container) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>Failed to load wishlists. Please try again.</p></div>';
            }
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
        fetch('/api/reviews', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
            const reviews = data.reviews || [];
            const averageRating = data.averageRating || 0;

                // Update profile statistics if elements exist
                const totalReviewsEl = document.getElementById('totalReviews');
                const avgReviewRatingEl = document.getElementById('avgReviewRating');
                
                if (totalReviewsEl) totalReviewsEl.textContent = reviews.length;
                if (avgReviewRatingEl) avgReviewRatingEl.textContent = averageRating;

            container.innerHTML = '';

            if (reviews.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-star"></i>
                            <h3>No Reviews Yet</h3>
                            <p>Start sharing your gaming experiences!</p>
                            <button class="btn btn-primary" onclick="app.showAddReviewModal()">
                                <i class="fas fa-plus"></i> Write Your First Review
                            </button>
                        </div>
                    `;
            } else {
                reviews.forEach(review => {
                    const reviewItem = document.createElement('div');
                    reviewItem.className = 'review-item';
                    reviewItem.innerHTML = `
                            <div class="review-content">
                                <div class="review-header">
                                    <h4 class="review-game-title">${review.gameTitle}</h4>
                                    <div class="review-rating">
                                ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                                        <span class="rating-number">${review.rating}/5</span>
                            </div>
                        </div>
                                <div class="review-text">${review.reviewText}</div>
                                ${review.tags && review.tags.length > 0 ? `
                                    <div class="review-tags">
                                        ${review.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                    </div>
                                ` : ''}
                                <div class="review-meta">
                                    <span class="review-date">${new Date(review.createdAt).toLocaleDateString()}</span>
                                    ${review.helpfulVotes > 0 ? `<span class="helpful-votes">${review.helpfulVotes} helpful</span>` : ''}
                                    ${!review.isPublic ? '<span class="private-review">Private</span>' : ''}
                                </div>
                            </div>
                            <div class="review-actions">
                                <button class="btn btn-secondary btn-sm" onclick="app.editReview(${review.id})">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="app.deleteReview(${review.id})">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                    `;
                    container.appendChild(reviewItem);
                });
                }
            } else {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>Failed to load reviews. Please try again.</p></div>';
            }
        })
        .catch(error => {
            console.error('Error fetching reviews:', error);
            container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>Failed to load reviews. Please try again.</p></div>';
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
                this.showAlert(data.error || 'Failed to update profile', 'Update Failed', 'error');
            }
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            this.showAlert('Error updating profile. Please try again.', 'Error', 'error');
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
            this.showAlert('Please enter a username', 'Username Required', 'warning');
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

    async createWishlist() {
        const name = document.getElementById('wishlistName').value;
        const description = document.getElementById('wishlistDescription').value;

        if (!name) {
            this.showAlert('Please enter a wishlist name', 'Wishlist Name Required', 'warning');
            return;
        }

        if (!this.currentUser) {
            this.showAlert('Please log in to create a wishlist', 'Login Required', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/create`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description || '',
                    isPublic: false,
                    priority: 'medium'
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.closeModal(document.getElementById('createWishlistModal'));
                // Clear form
                document.getElementById('wishlistName').value = '';
                document.getElementById('wishlistDescription').value = '';
                this.updateWishlists();
                this.showNotification('Wishlist created successfully!', 'success');
            } else {
                this.showAlert(data.error || 'Failed to create wishlist', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error creating wishlist:', error);
            this.showAlert('Error creating wishlist. Please try again.', 'Error', 'error');
        }
    }

    async selectWishlist(wishlistId) {
        if (!this.currentUser) {
            this.showAlert('Please log in to view wishlists', 'Login Required', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/${wishlistId}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                const container = document.getElementById('wishlistGames');
                const title = document.getElementById('selectedWishlistTitle');
                const selectedSection = document.getElementById('selectedWishlistSection');
                const wishlistContainer = document.getElementById('wishlistContainer');
                
                // Show selected wishlist section, hide wishlists list
                if (selectedSection) {
                    selectedSection.style.display = 'block';
                }
                if (wishlistContainer && wishlistContainer.parentElement) {
                    wishlistContainer.parentElement.style.display = 'none';
                }
                
                if (title) {
                    title.textContent = data.wishlist.name;
                }

                if (container) {
                    container.innerHTML = '';

                    if (!data.games || data.games.length === 0) {
                        container.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><h3>No Games</h3><p>Add some games to this wishlist!</p></div>';
                        return;
                    }

                    data.games.forEach(game => {
                        const gameItem = document.createElement('div');
                        gameItem.className = 'friend-item';
                        gameItem.innerHTML = `
                            <div>
                                <strong>${game.title}</strong>
                                <br>
                                <small>${game.platform || 'PC'} • Added: ${new Date(game.addedDate).toLocaleDateString()}</small>
                            </div>
                            <button class="btn btn-danger" onclick="app.removeFromWishlist(${wishlistId}, ${game.gameId})">Remove</button>
                        `;
                        container.appendChild(gameItem);
                    });
                }
            } else {
                this.showAlert(data.error || 'Failed to load wishlist', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error loading wishlist:', error);
            this.showAlert('Error loading wishlist. Please try again.', 'Error', 'error');
        }
    }

    async removeFromWishlist(wishlistId, gameId) {
        if (!this.currentUser) {
            this.showAlert('Please log in to manage wishlists', 'Login Required', 'warning');
            return;
        }

        // Use a custom confirm dialog - for now we'll use browser confirm but could enhance this later
        if (!confirm('Are you sure you want to remove this game from the wishlist?')) {
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/${wishlistId}/games/${gameId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification(data.message || 'Game removed from wishlist', 'success');
                this.selectWishlist(wishlistId); // Refresh the wishlist view
                this.updateWishlists(); // Update the wishlists list
            } else {
                this.showAlert(data.error || 'Failed to remove game from wishlist', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error removing game from wishlist:', error);
            this.showAlert('Error removing game from wishlist. Please try again.', 'Error', 'error');
        }
    }
    
    // Helper function to go back to wishlists view
    backToWishlists() {
        const selectedSection = document.getElementById('selectedWishlistSection');
        const wishlistContainer = document.getElementById('wishlistContainer');
        
        if (selectedSection) {
            selectedSection.style.display = 'none';
        }
        if (wishlistContainer && wishlistContainer.parentElement) {
            wishlistContainer.parentElement.style.display = 'block';
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
        const isPublic = document.getElementById('reviewPublic').checked;

        if (!gameTitle || !reviewText || !rating) {
            this.showAlert('Please fill in all required fields', 'Validation Error', 'warning');
            return;
        }

        if (reviewText.length < 10) {
            this.showAlert('Review text must be at least 10 characters long', 'Validation Error', 'warning');
            return;
        }

        if (reviewText.length > 5000) {
            this.showAlert('Review text must be less than 5000 characters', 'Validation Error', 'warning');
            return;
        }

        fetch('/api/reviews', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gameTitle: gameTitle,
                rating: rating,
                reviewText: reviewText,
                tags: tags,
                isPublic: isPublic
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
            this.closeModal(document.getElementById('addReviewModal'));
            this.updateReviews();
                this.showNotification('Review added successfully!', 'success');
            } else {
                this.showAlert(data.error || 'Failed to add review', 'Error', 'error');
            }
        })
        .catch(error => {
            console.error('Error adding review:', error);
            this.showAlert('Failed to add review. Please try again.', 'Error', 'error');
        });
    }

    editReview(reviewId) {
        // First, fetch the review data to populate the edit form
        fetch('/api/reviews', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const review = data.reviews.find(r => r.id === reviewId);
                if (review) {
                    // Populate the edit form
                    document.getElementById('editReviewId').value = review.id;
                    document.getElementById('editGameTitle').value = review.gameTitle;
                    document.getElementById('editRating').value = review.rating;
                    document.getElementById('editReviewText').value = review.reviewText;
                    document.getElementById('editTags').value = review.tags ? review.tags.join(', ') : '';
                    document.getElementById('editReviewPublic').checked = review.isPublic;
                    
                    // Update star rating display
                    this.updateStarRating('editStarRating', review.rating);
                    this.updateCharCount('editReviewText', 'editCharCount');
                    
                    // Show the edit modal
                    const editModal = document.getElementById('editReviewModal');
                    if (editModal) {
                        editModal.style.display = 'block';
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error fetching review:', error);
            this.showAlert('Failed to load review for editing', 'Error', 'error');
        });
    }

    updateReview() {
        const reviewId = document.getElementById('editReviewId').value;
        const gameTitle = document.getElementById('editGameTitle').value;
        const rating = parseInt(document.getElementById('editRating').value);
        const reviewText = document.getElementById('editReviewText').value;
        const tags = document.getElementById('editTags').value.split(',').map(t => t.trim()).filter(t => t);
        const isPublic = document.getElementById('editReviewPublic').checked;

        if (!gameTitle || !reviewText || !rating) {
            this.showAlert('Please fill in all required fields', 'Validation Error', 'warning');
            return;
        }

        if (reviewText.length < 10) {
            this.showAlert('Review text must be at least 10 characters long', 'Validation Error', 'warning');
            return;
        }

        if (reviewText.length > 5000) {
            this.showAlert('Review text must be less than 5000 characters', 'Validation Error', 'warning');
            return;
        }

        fetch(`/api/reviews/${reviewId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gameTitle: gameTitle,
                rating: rating,
                reviewText: reviewText,
                tags: tags,
                isPublic: isPublic
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.closeModal(document.getElementById('editReviewModal'));
                this.updateReviews();
                this.showNotification('Review updated successfully!', 'success');
            } else {
                this.showAlert(data.error || 'Failed to update review', 'Error', 'error');
            }
        })
        .catch(error => {
            console.error('Error updating review:', error);
            this.showAlert('Failed to update review. Please try again.', 'Error', 'error');
        });
    }

    deleteReview(reviewId) {
        if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
            return;
        }

        fetch(`/api/reviews/${reviewId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
            this.updateReviews();
                this.showNotification('Review deleted successfully!', 'success');
            } else {
                this.showAlert(data.error || 'Failed to delete review', 'Error', 'error');
        }
        })
        .catch(error => {
            console.error('Error deleting review:', error);
            this.showAlert('Failed to delete review. Please try again.', 'Error', 'error');
        });
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
            this.showAlert('Please fill in all fields', 'Admin Login Required', 'warning');
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
                this.showAlert(data.error || 'Invalid admin credentials', 'Admin Login Failed', 'error');
            }
        })
        .catch(error => {
            console.error('Error logging in as admin:', error);
            this.showAlert('Error logging in as admin. Please try again.', 'Error', 'error');
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
            this.showAlert('Search input not found', 'Error', 'error');
            return;
        }
        
        const query = searchInput.value.trim();
        console.log('Search query:', query);
        
        if (!query) {
            this.showAlert('Please enter a search term', 'Search Required', 'warning');
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
                <strong>Loading:</strong> The Steam game database is being loaded. If you see sample data, the Steam app list is still loading (this may take a moment on first use).
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

    async viewGameDetails(gameId) {
        try {
            // Show loading state
            this.showGameDetailsLoading();
            
            // Fetch game details from API
            const response = await fetch(`/api/games/${gameId}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.game) {
                this.showGameDetailsModal(data.game);
            } else {
                this.showAlert(data.error || 'Failed to load game details', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error fetching game details:', error);
            this.showAlert('Error loading game details. Please try again.', 'Error', 'error');
        }
    }

    showGameDetailsLoading() {
        // Create or show loading modal
        let loadingModal = document.getElementById('gameDetailsLoading');
        if (!loadingModal) {
            loadingModal = document.createElement('div');
            loadingModal.id = 'gameDetailsLoading';
            loadingModal.className = 'modal';
            loadingModal.innerHTML = `
                <div class="modal-content">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading game details...</p>
                    </div>
                </div>
            `;
            document.body.appendChild(loadingModal);
        }
        loadingModal.style.display = 'block';
    }

    showGameDetailsModal(gameData) {
        // Hide loading
        const loadingModal = document.getElementById('gameDetailsLoading');
        if (loadingModal) {
            loadingModal.style.display = 'none';
        }

        // Create or update game details modal
        let gameModal = document.getElementById('gameDetailsModal');
        if (!gameModal) {
            gameModal = document.createElement('div');
            gameModal.id = 'gameDetailsModal';
            gameModal.className = 'modal game-details-modal';
            document.body.appendChild(gameModal);
        }

        // Format game data for display
        const platforms = gameData.platforms && gameData.platforms.length > 0 
            ? gameData.platforms.map(p => p.name).join(', ')
            : 'Not specified';
        
        const genres = gameData.genres && gameData.genres.length > 0
            ? gameData.genres.map(g => g.name).join(', ')
            : 'Not specified';
        
        const developers = gameData.developers && gameData.developers.length > 0
            ? gameData.developers.map(d => d.name).join(', ')
            : 'Not specified';
        
        const publishers = gameData.publishers && gameData.publishers.length > 0
            ? gameData.publishers.map(p => p.name).join(', ')
            : 'Not specified';

        const releaseDate = gameData.released 
            ? new Date(gameData.released).toLocaleDateString()
            : 'TBA';

        const rating = gameData.rating 
            ? `${gameData.rating.toFixed(1)}/5`
            : 'N/A';

        const description = gameData.description || gameData.description_raw || 'No description available';

        // Build modal HTML
        gameModal.innerHTML = `
            <div class="modal-content game-details-content">
                <span class="close" onclick="app.closeGameDetailsModal()">&times;</span>
                <div class="game-details-header">
                    ${gameData.backgroundImage 
                        ? `<img src="${gameData.backgroundImage}" alt="${gameData.name}" class="game-details-image">`
                        : '<div class="game-details-image-placeholder"><i class="fas fa-gamepad"></i></div>'
                    }
                    <div class="game-details-title-section">
                        <h2>${gameData.name || 'Unknown Game'}</h2>
                        <div class="game-details-meta">
                            ${rating !== 'N/A' ? `<span class="game-rating"><i class="fas fa-star"></i> ${rating}</span>` : ''}
                            ${gameData.metacritic ? `<span class="game-metacritic">Metacritic: ${gameData.metacritic}</span>` : ''}
                            ${releaseDate !== 'TBA' ? `<span class="game-release-date"><i class="fas fa-calendar"></i> ${releaseDate}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="game-details-body">
                    <div class="game-details-description">
                        <h3>Description</h3>
                        <p>${description}</p>
                    </div>
                    <div class="game-details-info">
                        <div class="info-row">
                            <strong>Platforms:</strong> ${platforms}
                        </div>
                        <div class="info-row">
                            <strong>Genres:</strong> ${genres}
                        </div>
                        ${developers !== 'Not specified' ? `
                        <div class="info-row">
                            <strong>Developers:</strong> ${developers}
                        </div>
                        ` : ''}
                        ${publishers !== 'Not specified' ? `
                        <div class="info-row">
                            <strong>Publishers:</strong> ${publishers}
                        </div>
                        ` : ''}
                    </div>
                    ${gameData.screenshots && gameData.screenshots.length > 0 ? `
                    <div class="game-details-screenshots">
                        <h3>Screenshots</h3>
                        <div class="screenshots-grid">
                            ${gameData.screenshots.slice(0, 4).map(screenshot => `
                                <img src="${screenshot.image || screenshot}" alt="Screenshot" class="screenshot-thumbnail">
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="game-details-actions">
                    ${this.currentUser ? `
                        <button class="btn btn-primary" onclick="app.handleAddToWishlist(${gameData.id}, '${gameData.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-heart"></i> Add to Wishlist
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="app.showLoginModal()">
                            <i class="fas fa-sign-in-alt"></i> Login to Add to Wishlist
                        </button>
                    `}
                    ${gameData.website ? `
                        <a href="${gameData.website}" target="_blank" class="btn btn-secondary">
                            <i class="fas fa-external-link-alt"></i> Visit Website
                        </a>
                    ` : ''}
                </div>
            </div>
        `;

        gameModal.style.display = 'block';
    }

    closeGameDetailsModal() {
        const gameModal = document.getElementById('gameDetailsModal');
        const loadingModal = document.getElementById('gameDetailsLoading');
        if (gameModal) {
            gameModal.style.display = 'none';
        }
        if (loadingModal) {
            loadingModal.style.display = 'none';
        }
    }

    async addToWishlist(gameId, gameName) {
        if (!this.currentUser) {
            this.showAlert('Please log in to add games to your wishlist', 'Login Required', 'warning');
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
                this.showAlert(`Added "${gameName}" to wishlist!`, 'Success', 'success');
            } else {
                this.showAlert('Failed to add game to wishlist: ' + result.error, 'Error', 'error');
            }
        } catch (error) {
            console.error('Error adding game to wishlist:', error);
            this.showAlert('Error adding game to wishlist', 'Error', 'error');
        }
    }

    async addToWishlistWithId(gameId, gameName, wishlistId) {
        if (!this.currentUser) {
            this.showAlert('Please log in to add games to your wishlist', 'Login Required', 'warning');
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
                    wishlistId: wishlistId,
                    gameData: {
                        addedDate: new Date().toISOString()
                    }
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showAlert(`Added "${gameName}" to wishlist!`, 'Success', 'success');
                // Close wishlist selection modal if open
                const selectionModal = document.getElementById('wishlistSelectionModal');
                if (selectionModal) {
                    selectionModal.style.display = 'none';
                }
            } else {
                this.showAlert('Failed to add game to wishlist: ' + result.error, 'Error', 'error');
            }
        } catch (error) {
            console.error('Error adding game to wishlist:', error);
            this.showAlert('Error adding game to wishlist', 'Error', 'error');
        }
    }

    showWishlistSelectionModal(gameId, gameName, wishlists) {
        // Create or update wishlist selection modal
        let selectionModal = document.getElementById('wishlistSelectionModal');
        if (!selectionModal) {
            selectionModal = document.createElement('div');
            selectionModal.id = 'wishlistSelectionModal';
            selectionModal.className = 'modal';
            document.body.appendChild(selectionModal);
        }

        selectionModal.innerHTML = `
            <div class="modal-content wishlist-selection-content">
                <span class="close" onclick="app.closeWishlistSelectionModal()">&times;</span>
                <h2>Add "${gameName}" to Wishlist</h2>
                <p class="wishlist-selection-subtitle">Choose which wishlist to add this game to:</p>
                <div class="wishlist-list">
                    ${wishlists.map(wishlist => `
                        <div class="wishlist-item" onclick="app.addToWishlistWithId(${gameId}, '${gameName.replace(/'/g, "\\'")}', ${wishlist.id})">
                            <div class="wishlist-item-info">
                                <h3>${wishlist.name}</h3>
                                ${wishlist.description ? `<p>${wishlist.description}</p>` : ''}
                                <span class="wishlist-item-meta">
                                    ${wishlist.gameCount || 0} ${wishlist.gameCount === 1 ? 'game' : 'games'}
                                    ${wishlist.isPublic ? '<i class="fas fa-globe" title="Public"></i>' : '<i class="fas fa-lock" title="Private"></i>'}
                                </span>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    `).join('')}
                </div>
                <div class="wishlist-selection-actions">
                    <button class="btn btn-secondary" onclick="app.closeWishlistSelectionModal()">Cancel</button>
                </div>
            </div>
        `;

        selectionModal.style.display = 'block';
    }

    closeWishlistSelectionModal() {
        const selectionModal = document.getElementById('wishlistSelectionModal');
        if (selectionModal) {
            selectionModal.style.display = 'none';
        }
    }

    async handleAddToWishlist(gameId, gameName) {
        if (!this.currentUser) {
            this.showAlert('Please log in to add games to your wishlist', 'Login Required', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            const wishlists = data.success ? (data.wishlists || []) : [];

            if (wishlists.length === 0) {
                // No wishlists, create default and add
                await this.addToWishlist(gameId, gameName);
            } else if (wishlists.length === 1) {
                // Only one wishlist, add directly
                await this.addToWishlistWithId(gameId, gameName, wishlists[0].id);
            } else {
                // Multiple wishlists, show selection modal
                this.showWishlistSelectionModal(gameId, gameName, wishlists);
            }
        } catch (error) {
            console.error('Error handling add to wishlist:', error);
            // Fallback to default behavior
            await this.addToWishlist(gameId, gameName);
        }
    }

    // Friend management methods
    async updateFriends() {
        if (!this.currentUser) {
            this.showLoginRequired('friends');
            return;
        }

        try {
            const response = await fetch(`/api/friends/${this.currentUser.username}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.displayFriends(data.friends);
                this.displayReceivedRequests(data.receivedRequests);
                this.displaySentRequests(data.sentRequests);
            } else {
                console.error('Failed to load friends');
            }
        } catch (error) {
            console.error('Error loading friends:', error);
        }
    }

   displayFriends(friends) {
    const container = document.getElementById('friendsList');
    const countElement = document.getElementById('friendsCount');

    if (!container) return;

    // Update friend count
    if (countElement) {
        countElement.textContent = friends.length;
    }

    // Handle empty list
    if (friends.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <h3>No friends yet</h3>
                <p>Send friend requests to start building your network!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    friends.forEach(friend => {
        // Normalize date
        const date = friend.friendshipDate || friend.acceptedDate || friend.createdDate;
        const formattedDate = date ? new Date(date).toLocaleDateString() : 'N/A';

        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';

        friendItem.innerHTML = `
            <div class="friend-info">
                <div class="friend-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="friend-details">
                    <h4>${friend.username}</h4>
                    <p>Friends since: ${formattedDate}</p>
                    ${friend.bio ? `<p class="friend-bio">${friend.bio}</p>` : ''}
                </div>
            </div>
            <div class="friend-actions">
                <button class="btn btn-danger" onclick="app.removeFriend(${friend.friendId})">Remove</button>
            </div>
        `;

        container.appendChild(friendItem);

        // Add View Profile button dynamically before Remove button
        const actionsDiv = friendItem.querySelector('.friend-actions');
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View Profile';
        viewBtn.className = 'btn btn-primary';
        viewBtn.addEventListener('click', () => this.viewFriendProfile(friend));
        actionsDiv.insertBefore(viewBtn, actionsDiv.firstChild);
    });
}





    displayReceivedRequests(requests) {
        const container = document.getElementById('receivedRequests');
        const countElement = document.getElementById('receivedRequestsCount');
        
        if (!container) return;

        if (countElement) {
            countElement.textContent = requests.length;
        }

        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-plus"></i>
                    <h3>No friend requests</h3>
                    <p>You'll see friend requests here when people want to add you!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        requests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'friend-request-item';
            requestItem.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="friend-details">
                        <h4>${request.username}</h4>
                        <p>Sent: ${new Date(request.sentDate).toLocaleDateString()}</p>
                        ${request.bio ? `<p class="friend-bio">${request.bio}</p>` : ''}
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="btn btn-success" onclick="app.acceptFriendRequest(${request.id})">Accept</button>
                    <button class="btn btn-danger" onclick="app.declineFriendRequest(${request.id})">Decline</button>
                </div>
            `;
            container.appendChild(requestItem);
        });
    }

    displaySentRequests(requests) {
        const container = document.getElementById('sentRequests');
        const countElement = document.getElementById('sentRequestsCount');
        
        if (!container) return;

        if (countElement) {
            countElement.textContent = requests.length;
        }

        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-paper-plane"></i>
                    <h3>No sent requests</h3>
                    <p>Your sent friend requests will appear here!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        requests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'friend-request-item';
            requestItem.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="friend-details">
                        <h4>${request.username}</h4>
                        <p>Sent: ${new Date(request.sentDate).toLocaleDateString()}</p>
                        <span class="status-pending">Pending</span>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="btn btn-secondary" onclick="app.cancelFriendRequest(${request.id})">Cancel</button>
                </div>
            `;
            container.appendChild(requestItem);
        });
    }

    async sendFriendRequest() {
        const usernameInput = document.getElementById('friendUsernameInput');
        if (!usernameInput || !this.currentUser) return;

        const friendUsername = usernameInput.value.trim();
        if (!friendUsername) {
            this.showAlert('Please enter a username', 'Username Required', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/friends/${this.currentUser.username}/request`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ friendUsername })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showAlert(data.message, 'Success', 'success');
                usernameInput.value = '';
                this.updateFriends();
            } else {
                this.showAlert(data.error || 'Failed to send friend request', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error sending friend request:', error);
            this.showAlert('Failed to send friend request', 'Error', 'error');
        }
    }

    async acceptFriendRequest(requestId) {
        try {
            const response = await fetch(`/api/friends/${this.currentUser.username}/accept/${requestId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showAlert(data.message, 'Success', 'success');
                this.updateFriends();
            } else {
                this.showAlert(data.error || 'Failed to accept friend request', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error accepting friend request:', error);
            this.showAlert('Failed to accept friend request', 'Error', 'error');
        }
    }

    async declineFriendRequest(requestId) {
        try {
            const response = await fetch(`/api/friends/${this.currentUser.username}/decline/${requestId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showAlert(data.message, 'Success', 'success');
                this.updateFriends();
            } else {
                this.showAlert(data.error || 'Failed to decline friend request', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error declining friend request:', error);
            this.showAlert('Failed to decline friend request', 'Error', 'error');
        }
    }

    async removeFriend(friendId) {
        if (!confirm('Are you sure you want to remove this friend?')) {
            return;
        }

        try {
            const response = await fetch(`/api/friends/${this.currentUser.username}/remove/${friendId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showAlert(data.message, 'Success', 'success');
                this.updateFriends();
            } else {
                this.showAlert(data.error || 'Failed to remove friend', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error removing friend:', error);
            this.showAlert('Failed to remove friend', 'Error', 'error');
        }
    }

    async cancelFriendRequest(requestId) {
        try {
            const response = await fetch(`/api/friends/${this.currentUser.username}/cancel/${requestId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showNotification(data.message || 'Friend request canceled', 'success');
                this.updateFriends();
            } else {
                this.showAlert(data.error || 'Failed to cancel friend request', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error canceling friend request:', error);
            this.showAlert('Failed to cancel friend request', 'Error', 'error');
        }
    }

    showLoginRequired(section) {
        const containers = {
            friends: document.getElementById('friendsList'),
            received: document.getElementById('receivedRequests'),
            sent: document.getElementById('sentRequests')
        };

        Object.values(containers).forEach(container => {
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-sign-in-alt"></i>
                        <h3>Login Required</h3>
                        <p>Please log in to manage your friends!</p>
                    </div>
                `;
            }
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Hide and remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    showAlert(message, title = 'Alert', type = 'info') {
        return new Promise((resolve) => {
            const modal = document.getElementById('customAlertModal');
            const alertIcon = document.getElementById('alertIcon');
            const alertTitle = document.getElementById('alertTitle');
            const alertMessage = document.getElementById('alertMessage');
            const alertOkBtn = document.getElementById('alertOkBtn');
            const alertHeader = alertIcon.parentElement;

            if (!modal || !alertIcon || !alertTitle || !alertMessage || !alertOkBtn) {
                // Fallback to browser alert if modal elements don't exist
                // This should rarely happen, but provides a fallback
                if (typeof alert !== 'undefined') {
                    alert(message);
                }
                resolve();
                return;
            }

            // Set icon and type styling
            let iconClass = 'fa-info-circle';
            let headerClass = 'info';
            
            if (type === 'success') {
                iconClass = 'fa-check-circle';
                headerClass = 'success';
            } else if (type === 'error') {
                iconClass = 'fa-exclamation-circle';
                headerClass = 'error';
            } else if (type === 'warning') {
                iconClass = 'fa-exclamation-triangle';
                headerClass = 'warning';
            }

            alertIcon.className = `fas ${iconClass}`;
            alertHeader.className = `alert-modal-header ${headerClass}`;
            alertTitle.textContent = title;
            alertMessage.textContent = message;

            // Show modal
            modal.style.display = 'block';

            // Define event handlers
            let handleEscape, handleOutsideClick, handleOk;

            // Handle Escape key
            handleEscape = (e) => {
                if (e.key === 'Escape' && modal.style.display === 'block') {
                    modal.style.display = 'none';
                    document.removeEventListener('keydown', handleEscape);
                    if (handleOutsideClick) modal.removeEventListener('click', handleOutsideClick);
                    resolve();
                }
            };

            // Handle clicking outside modal
            handleOutsideClick = (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    modal.removeEventListener('click', handleOutsideClick);
                    document.removeEventListener('keydown', handleEscape);
                    resolve();
                }
            };

            // Handle OK button click
            handleOk = () => {
                modal.style.display = 'none';
                document.removeEventListener('keydown', handleEscape);
                modal.removeEventListener('click', handleOutsideClick);
                resolve();
            };

            // Add event listeners
            alertOkBtn.onclick = null;
            alertOkBtn.addEventListener('click', handleOk);
            modal.addEventListener('click', handleOutsideClick);
            document.addEventListener('keydown', handleEscape);
        });
    }

    setupStarRating(containerId, inputId, textId) {
        const container = document.getElementById(containerId);
        const input = document.getElementById(inputId);
        const textElement = document.querySelector(`#${containerId} + .rating-text`);
        
        if (!container || !input) return;

        const stars = container.querySelectorAll('.star');
        
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                const rating = index + 1;
                this.updateStarRating(containerId, rating);
                input.value = rating;
                if (textElement) {
                    textElement.textContent = `${rating} star${rating !== 1 ? 's' : ''}`;
                }
            });

            star.addEventListener('mouseenter', () => {
                this.highlightStars(containerId, index + 1);
            });
        });

        container.addEventListener('mouseleave', () => {
            const currentRating = parseInt(input.value) || 5;
            this.highlightStars(containerId, currentRating);
        });
    }

    updateStarRating(containerId, rating) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stars = container.querySelectorAll('.star');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    highlightStars(containerId, rating) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stars = container.querySelectorAll('.star');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.style.color = '#ffd700';
            } else {
                star.style.color = '#ddd';
            }
        });
    }

    updateCharCount(textareaId, countId) {
        const textarea = document.getElementById(textareaId);
        const countElement = document.getElementById(countId);
        
        if (textarea && countElement) {
            const count = textarea.value.length;
            countElement.textContent = count;
            
            // Change color based on character count
            if (count > 4500) {
                countElement.style.color = '#e74c3c';
            } else if (count > 4000) {
                countElement.style.color = '#f39c12';
            } else {
                countElement.style.color = '#7f8c8d';
            }
        }
    }

    // Generate star rating display (1-5 stars with half stars)
    generateStarRating(rating) {
        if (!rating || rating <= 0) {
            return '<span class="no-rating">No rating</span>';
        }

        // Ensure rating is between 0 and 5
        const normalizedRating = Math.min(Math.max(rating, 0), 5);
        const fullStars = Math.floor(normalizedRating);
        const hasHalfStar = normalizedRating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let starsHTML = '';
        
        // Full stars
        for (let i = 0; i < fullStars; i++) {
            starsHTML += '<i class="fas fa-star star-full"></i>';
        }
        
        // Half star
        if (hasHalfStar) {
            starsHTML += '<i class="fas fa-star-half-alt star-half"></i>';
        }
        
        // Empty stars
        for (let i = 0; i < emptyStars; i++) {
            starsHTML += '<i class="far fa-star star-empty"></i>';
        }

        return `<div class="star-rating-display">${starsHTML}</div>`;
    }

    // Autocomplete functionality
    async getSearchSuggestions(query) {
        try {
            const response = await fetch(`/api/games/suggestions?q=${encodeURIComponent(query)}&limit=5`);
            if (!response.ok) {
                throw new Error('Failed to fetch suggestions');
            }
            
            const data = await response.json();
            if (data.success && data.suggestions.length > 0) {
                this.showSearchSuggestions(data.suggestions);
            } else {
                this.hideSearchSuggestions();
            }
        } catch (error) {
            console.error('Error fetching search suggestions:', error);
            this.hideSearchSuggestions();
        }
    }

    showSearchSuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        if (!suggestionsContainer) return;

        suggestionsContainer.innerHTML = '';
        
        suggestions.forEach(suggestion => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.innerHTML = `
                <div class="suggestion-content">
                    <div class="suggestion-title">${suggestion.name}</div>
                    <div class="suggestion-meta">
                        ${suggestion.released ? new Date(suggestion.released).getFullYear() : 'TBA'}
                        ${suggestion.rating ? ` • ${suggestion.rating.toFixed(1)}/5` : ''}
                    </div>
                </div>
            `;
            
            suggestionItem.addEventListener('click', () => {
                document.getElementById('gameSearchInput').value = suggestion.name;
                this.hideSearchSuggestions();
                window.location.href = `/search?q=${encodeURIComponent(suggestion.name)}`;
            });
            
            suggestionsContainer.appendChild(suggestionItem);
        });
        
        suggestionsContainer.style.display = 'block';
    }

    hideSearchSuggestions() {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
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
                if (window.app) {
                    window.app.showAlert('Username not found in URL', 'Error', 'error');
                } else {
                    alert('Username not found in URL');
                }
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
                if (window.app) {
                    window.app.showAlert('Failed to connect Steam account: ' + result.error, 'Error', 'error');
                } else {
                    alert('Failed to connect Steam account: ' + result.error);
                }
            }
        } catch (error) {
            console.error('Error connecting Steam:', error);
            if (window.app) {
                window.app.showAlert('Error connecting Steam account', 'Error', 'error');
            } else {
                alert('Error connecting Steam account');
            }
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
                if (window.app) {
                    window.app.showAlert('Username not found in URL', 'Error', 'error');
                } else {
                    alert('Username not found in URL');
                }
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
                if (window.app) {
                    window.app.showAlert('Steam account disconnected successfully', 'Success', 'success');
                } else {
                    alert('Steam account disconnected successfully');
                }
            } else {
                if (window.app) {
                    window.app.showAlert('Failed to disconnect Steam account: ' + result.error, 'Error', 'error');
                } else {
                    alert('Failed to disconnect Steam account: ' + result.error);
                }
            }
        } catch (error) {
            console.error('Error disconnecting Steam:', error);
            if (window.app) {
                window.app.showAlert('Error disconnecting Steam account', 'Error', 'error');
            } else {
                alert('Error disconnecting Steam account');
            }
        }
    }

    async importSteamLibrary() {
        try {
            console.log('Importing Steam library...');
            
            // Get username from URL
            const username = this.getUsernameFromUrl();
            if (!username) {
                if (window.app) {
                    window.app.showAlert('Username not found in URL', 'Error', 'error');
                } else {
                    alert('Username not found in URL');
                }
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
                if (window.app) {
                    window.app.showAlert(`Successfully imported ${gamesCount} games from Steam!`, 'Success', 'success');
                } else {
                    alert(`Successfully imported ${gamesCount} games from Steam!`);
                }
                // Stay on the profile page and reload to show updated stats
                const currentUrl = window.location.href;
                window.location.href = currentUrl;
            } else {
                if (window.app) {
                    window.app.showAlert('Failed to import Steam library: ' + result.error, 'Error', 'error');
                } else {
                    alert('Failed to import Steam library: ' + result.error);
                }
            }
        } catch (error) {
            console.error('Error importing Steam library:', error);
            if (window.app) {
                window.app.showAlert('Error importing Steam library: ' + error.message, 'Error', 'error');
            } else {
                alert('Error importing Steam library: ' + error.message);
            }
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
