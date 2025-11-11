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

        this.title.textContent = 'Welcome to Game Vault';
        this.loginForm.style.display = 'block';
        this.signupForm.style.display = 'none';
        
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

class GameVaultApp {
    constructor() {
        this.loginScreen = new LoginScreen();
        this.currentUser = null;
        this.reviewState = {
            allReviews: [],
            filteredReviews: [],
            filters: {
                search: '',
                rating: 'all',
                visibility: 'all',
                tags: [],
                sort: 'newest'
            },
            page: 1,
            pageSize: 6,
            totalPages: 1,
            initialized: false,
            loading: false
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSearchListeners();
        this.resetUI();
        this.checkAuthStatus();
    }

    setupEventListeners() {

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

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

        // Steam sign-in buttons
        const steamSignInBtn = document.getElementById('steamSignInBtn');
        if (steamSignInBtn) {
            steamSignInBtn.addEventListener('click', () => {
                this.handleSteamSignIn();
            });
        }

        const steamSignUpBtn = document.getElementById('steamSignUpBtn');
        if (steamSignUpBtn) {
            steamSignUpBtn.addEventListener('click', () => {
                this.handleSteamSignIn(); // Same flow for sign-in and sign-up
        });
        }

        const guestBtnLogin = document.getElementById('guestBtnLogin');
        if (guestBtnLogin) {
            guestBtnLogin.addEventListener('click', () => {
            this.handleGuestLogin();
        });
        }

        const signInBtn = document.getElementById('signInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => {
                this.loginScreen.show();
                this.loginScreen.resetToInitialState();
            });
        }

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

        // Avatar upload preview
        const editAvatarInput = document.getElementById('editAvatarInput');
        if (editAvatarInput) {
            editAvatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Validate file size (5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        this.showAlert('File size must be less than 5MB', 'File Too Large', 'error');
                        e.target.value = '';
                        return;
                    }

                    // Validate file type
                    if (!file.type.startsWith('image/')) {
                        this.showAlert('Please select an image file', 'Invalid File Type', 'error');
                        e.target.value = '';
                        return;
                    }

                    // Show preview
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const avatarPreview = document.getElementById('avatarPreview');
                        const avatarPreviewPlaceholder = document.getElementById('avatarPreviewPlaceholder');
                        const removeAvatarBtn = document.getElementById('removeAvatarBtn');
                        
                        if (avatarPreview && avatarPreviewPlaceholder) {
                            avatarPreview.src = e.target.result;
                            avatarPreview.style.display = 'block';
                            avatarPreviewPlaceholder.style.display = 'none';
                            if (removeAvatarBtn) removeAvatarBtn.style.display = 'inline-block';
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Remove avatar button
        const removeAvatarBtn = document.getElementById('removeAvatarBtn');
        if (removeAvatarBtn) {
            removeAvatarBtn.addEventListener('click', () => {
                const avatarPreview = document.getElementById('avatarPreview');
                const avatarPreviewPlaceholder = document.getElementById('avatarPreviewPlaceholder');
                const editAvatarInput = document.getElementById('editAvatarInput');
                
                if (avatarPreview && avatarPreviewPlaceholder) {
                    avatarPreview.src = '';
                    avatarPreview.style.display = 'none';
                    avatarPreviewPlaceholder.style.display = 'flex';
                    removeAvatarBtn.style.display = 'none';
                    if (editAvatarInput) editAvatarInput.value = '';
                }
            });
        }

        const sendFriendRequestBtn = document.getElementById('sendFriendRequestBtn');
        if (sendFriendRequestBtn) {
            sendFriendRequestBtn.addEventListener('click', () => {
            this.sendFriendRequest();
        });
        }

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

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
            this.handleLogout();
        });
        }

        const loginBtnProfile = document.getElementById('loginBtnProfile');
        if (loginBtnProfile) {
            loginBtnProfile.addEventListener('click', () => {
            this.showLoginModal();
        });
        }

        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal && modal.id !== 'authModal') {
                    this.closeModal(modal);
                }
            });
        });

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

        this.initializeReviewsPage();
    }

    setupSearchListeners() {

        setTimeout(() => {

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
        const loginError = document.getElementById('loginError');

        // Hide previous errors
        if (loginError) {
            loginError.style.display = 'none';
            loginError.textContent = '';
        }

        if (!username || !password) {
            if (loginError) {
                loginError.textContent = 'Please fill in all fields';
                loginError.style.display = 'block';
            } else {
            this.showAlert('Please fill in all fields', 'Login Required', 'warning');
            }
            return;
        }

        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                username,
                password
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.user) {
                // Hide error on success
                if (loginError) {
                    loginError.style.display = 'none';
                }
                this.currentUser = data.user;
                this.loginScreen.hide();
                this.updateUI();
                console.log('User logged in successfully:', data.user.username);
                
                // Update profile links immediately after login
                if (this.currentUser.username) {
                    const username = this.currentUser.username;
                    const navProfileLink = document.querySelector('.nav .nav-btn[href="/profile"]');
                    if (navProfileLink) {
                        navProfileLink.href = `/profile/${username}`;
                    }
                    const dropdownProfileLink = document.querySelector('.profile-menu-item[href="/profile"]');
                    if (dropdownProfileLink) {
                        dropdownProfileLink.href = `/profile/${username}`;
                    }
                }
                
                // Force a re-check of auth status to ensure session is properly set
                // Also wait a bit longer to ensure session cookie is set
                setTimeout(() => {
                    this.checkAuthStatus().then(() => {
                        // After auth check, ensure profile links are updated
                        if (this.currentUser && this.currentUser.username) {
                            const username = this.currentUser.username;
                            const navProfileLink = document.querySelector('.nav .nav-btn[href="/profile"], .nav .nav-btn[href*="/profile"]');
                            if (navProfileLink) {
                                navProfileLink.href = `/profile/${username}`;
                            }
                            const dropdownProfileLink = document.querySelector('.profile-menu-item[href="/profile"], .profile-menu-item[href*="/profile"]');
                            if (dropdownProfileLink) {
                                dropdownProfileLink.href = `/profile/${username}`;
                            }
                        }
                    });
                }, 200);
            } else {
                // Show error inline
                const errorMessage = data.error || 'Invalid credentials';
                if (loginError) {
                    loginError.textContent = errorMessage;
                    loginError.style.display = 'block';
                } else {
                    this.showAlert(errorMessage, 'Login Failed', 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error logging in:', error);
            const errorMessage = 'Error logging in. Please try again.';
            if (loginError) {
                loginError.textContent = errorMessage;
                loginError.style.display = 'block';
            } else {
                this.showAlert(errorMessage, 'Error', 'error');
            }
        });
    }

    handleSteamSignIn() {
        console.log('[Steam Sign-In] Initiating Steam authentication...');
        
        // Store in session that this is a sign-in (not linking)
        fetch('/api/auth/steam/signin', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                returnUrl: window.location.pathname
            })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Failed to initiate Steam sign-in');
        })
        .then(data => {
            if (data.redirectUrl) {
                console.log('[Steam Sign-In] Redirecting to Steam OAuth:', data.redirectUrl);
                window.location.href = data.redirectUrl;
            } else {
                throw new Error('No redirect URL received');
            }
        })
        .catch(error => {
            console.error('[Steam Sign-In] Error:', error);
            this.showAlert('Failed to connect to Steam. Please try again.', 'Steam Sign-In Error', 'error');
        });
    }

    handleSignup() {
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const playStyle = document.getElementById('playStyle').value;
        const favoriteGenres = document.getElementById('favoriteGenres').value.split(',').map(g => g.trim()).filter(g => g);
        const preferredPlatforms = document.getElementById('preferredPlatforms').value.split(',').map(p => p.trim()).filter(p => p);
        const signupError = document.getElementById('signupError');

        // Hide previous errors
        if (signupError) {
            signupError.style.display = 'none';
            signupError.textContent = '';
        }

        if (!username || !email || !password) {
            const errorMessage = 'Please fill in all required fields';
            if (signupError) {
                signupError.textContent = errorMessage;
                signupError.style.display = 'block';
            } else {
                this.showAlert(errorMessage, 'Signup Required', 'warning');
            }
            return;
        }

        const gamingPreferences = {
            favoriteGenres,
            preferredPlatforms,
            playStyle,
            gamingGoals: ['Explore new games', 'Build collection']
        };

        fetch('/api/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                username,
                email,
                password,
                gamingPreferences
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.user) {
                // Hide error on success
                if (signupError) {
                    signupError.style.display = 'none';
                }
                this.currentUser = data.user;
                this.loginScreen.hide();
                this.updateUI();
                console.log('User created successfully on server:', data.user.username);
                
                // Update profile links immediately after signup
                if (this.currentUser.username) {
                    const username = this.currentUser.username;
                    const navProfileLink = document.querySelector('.nav .nav-btn[href="/profile"]');
                    if (navProfileLink) {
                        navProfileLink.href = `/profile/${username}`;
                    }
                    const dropdownProfileLink = document.querySelector('.profile-menu-item[href="/profile"]');
                    if (dropdownProfileLink) {
                        dropdownProfileLink.href = `/profile/${username}`;
                    }
                }
                
                // Force a re-check of auth status to ensure session is properly set
                setTimeout(() => {
                    this.checkAuthStatus();
                }, 100);
            } else {
                // Show error inline
                const errorMessage = data.error || 'Failed to create account';
                if (signupError) {
                    signupError.textContent = errorMessage;
                    signupError.style.display = 'block';
                } else {
                    this.showAlert(errorMessage, 'Signup Failed', 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error creating account:', error);
            const errorMessage = 'Error creating account. Please try again.';
            if (signupError) {
                signupError.textContent = errorMessage;
                signupError.style.display = 'block';
            } else {
                this.showAlert(errorMessage, 'Error', 'error');
            }
        });
    }

    async checkAuthStatus() {
        try {
            const currentPath = window.location.pathname;
            const isProfilePage = currentPath.startsWith('/profile');
            const isLibraryPage = currentPath.startsWith('/library') || currentPath.startsWith('/wishlist');
            const isFriendsPage = currentPath.startsWith('/friends');
            const isReviewsPage = currentPath.startsWith('/reviews');
            const isProtectedPage = isProfilePage || isLibraryPage || isFriendsPage || isReviewsPage;
            
            console.log('[Auth Check] Checking auth status...');
            console.log('[Auth Check] Current URL:', window.location.href);
            console.log('[Auth Check] Current path:', currentPath);
            console.log('[Auth Check] Is protected page:', isProtectedPage);
            console.log('[Auth Check] Document cookies:', document.cookie);
            console.log('[Auth Check] Current user before check:', this.currentUser ? this.currentUser.username : 'none');
            
            // Preserve current user state before checking
            const previousUser = this.currentUser;
            
            // Always check auth status to refresh session if needed
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                credentials: 'include', // Important: include cookies for session
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache' // Prevent caching
                }
            });
            
            console.log('[Auth Check] Response status:', response.status);
            
            // Only parse JSON if response is OK
            if (!response.ok) {
                console.error('[Auth Check] Failed with status:', response.status);
                // If we had a user before, keep them - don't clear on error
                // Especially important on protected pages - don't clear user state
                if (previousUser) {
                    console.log('[Auth Check] Keeping previous user state due to error');
                    this.currentUser = previousUser;
                    this.updateUI();
                    return;
                }
                // If no previous user, show login on home page only
                // Never show login modal on protected pages
                if (!isProtectedPage && (currentPath === '/' || currentPath === '/index.html')) {
                    this.loginScreen.show();
                    this.loginScreen.resetToInitialState();
                }
                if (!isProtectedPage) {
                    this.showSignInButton();
                }
                return;
            }
            
            const data = await response.json();
            console.log('Auth check response data:', data);
            
            if (data.success && data.user) {
                this.currentUser = data.user;
                this.updateUI();
                console.log('User already logged in:', data.user.username);
                
                // Update profile links when auth check confirms user
                if (this.currentUser.username) {
                    const username = this.currentUser.username;
                    const navProfileLink = document.querySelector('.nav .nav-btn[href="/profile"]');
                    if (navProfileLink) {
                        navProfileLink.href = `/profile/${username}`;
                    }
                    const dropdownProfileLink = document.querySelector('.profile-menu-item[href="/profile"]');
                    if (dropdownProfileLink) {
                        dropdownProfileLink.href = `/profile/${username}`;
                    }
                }

                this.loginScreen.hide();
                if (this.updateFriends) {
                    this.updateFriends();
                    console.log('updateFriends called for', this.currentUser.username);
                }
            } else {
                console.log('[Auth Check] No active session found');
                
                // If we have a guest user, preserve it
                if (previousUser && (previousUser.isGuest === true || previousUser.username === 'Guest')) {
                    console.log('[Auth Check] Preserving guest state');
                    this.currentUser = previousUser;
                    this.updateUI();
                    return;
                }
                
                // On protected pages (profile, library, wishlist, friends), never clear user state or show login modal
                // These pages should preserve user state if it exists
                if (isProtectedPage) {
                    console.log('[Auth Check] On protected page - preserving user state if exists');
                    if (previousUser) {
                        this.currentUser = previousUser;
                        this.updateUI();
                        console.log('[Auth Check] Preserved user state on protected page:', previousUser.username);
                    }
                    // Don't show login modal on protected pages
                    return;
                }
                
                // Only clear user state if we're sure there's no session
                // Don't clear if we had a user before (might be a temporary error)
                if (!previousUser) {
                    this.currentUser = null;
                    
                    // Only show login on home page, not on other pages
                    if (currentPath === '/' || currentPath === '/index.html') {
                        console.log('[Auth Check] On home page, showing login screen');
                    this.loginScreen.show();
                    this.loginScreen.resetToInitialState();
                }
                    
                this.showSignInButton();
                } else {
                    // Keep previous user if check failed but we had one
                    // This is important - if we just logged in, don't clear the user state
                    console.log('[Auth Check] Keeping previous user state - session check returned no user but we had one before');
                    this.currentUser = previousUser;
                    this.updateUI();
                    
                    // Still update profile links even if session check failed
                    if (this.currentUser && this.currentUser.username && !this.currentUser.isGuest) {
                        const username = this.currentUser.username;
                        const navProfileLink = document.querySelector('.nav .nav-btn[href="/profile"], .nav .nav-btn[href*="/profile"]');
                        if (navProfileLink) {
                            navProfileLink.href = `/profile/${username}`;
                        }
                        const dropdownProfileLink = document.querySelector('.profile-menu-item[href="/profile"], .profile-menu-item[href*="/profile"]');
                        if (dropdownProfileLink) {
                            dropdownProfileLink.href = `/profile/${username}`;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Auth Check] Error checking auth status:', error);
            const currentPath = window.location.pathname;
            const isProfilePage = currentPath.startsWith('/profile');
            const isLibraryPage = currentPath.startsWith('/library') || currentPath.startsWith('/wishlist');
            const isFriendsPage = currentPath.startsWith('/friends');
            const isProtectedPage = isProfilePage || isLibraryPage || isFriendsPage;
            
            // Preserve existing user state on error
            if (this.currentUser) {
                console.log('[Auth Check] Error occurred but preserving current user state');
                this.updateUI();
                return;
            }
            
            // Only reset UI if we don't have a current user
            // Never show login modal on protected pages
            if (!isProtectedPage && (currentPath === '/' || currentPath === '/index.html')) {
                this.loginScreen.show();
                this.loginScreen.resetToInitialState();
            }
            
            if (!isProtectedPage) {
            this.showSignInButton();
            }
        }
    }

    async handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
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

            this.currentUser = null;
            this.resetUI();
            this.loginScreen.show();
            this.loginScreen.resetToInitialState();
        }
    }

    showLoginModal() {

        this.loginScreen.show();
        this.loginScreen.resetToInitialState();
    }

    handleGuestLogin() {
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
            isGuest: true,
            privacySettings: {
                profileVisibility: 'public',
                showEmail: false,
                showStatistics: true,
                showFriendsList: true
            }
        };

        this.loginScreen.hide();
        
        this.updateUI();
        
        // Explicitly ensure Sign In button is visible for guests
        setTimeout(() => {
            const signInBtnGuest = document.getElementById('signInBtnGuest');
            if (signInBtnGuest && this.currentUser && this.currentUser.isGuest) {
                signInBtnGuest.style.display = 'inline-block';
                signInBtnGuest.style.visibility = 'visible';
            }
        }, 100);
        
        console.log('Guest user logged in successfully');
    }

    resetUI() {

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
        
        const loginBtnProfile = document.getElementById('loginBtnProfile');
        if (loginBtnProfile) {
            loginBtnProfile.style.display = 'none';
        }
        
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

        const logoutBtn = document.getElementById('logoutBtn');
        const loginBtnProfile = document.getElementById('loginBtnProfile');
        const adminMenuLink = document.getElementById('adminMenuLink');
        
        // Update profile links to use username-specific route if available
        if (this.currentUser.username && !this.currentUser.isGuest) {
            const username = this.currentUser.username;
            
            // Update nav profile link
            const navProfileLink = document.querySelector('.nav .nav-btn[href="/profile"]');
            if (navProfileLink) {
                navProfileLink.href = `/profile/${username}`;
            }
            
            // Update dropdown profile link
            const dropdownProfileLink = document.querySelector('.profile-menu-item[href="/profile"]');
            if (dropdownProfileLink) {
                dropdownProfileLink.href = `/profile/${username}`;
            }
        }
        
        if (this.currentUser.isGuest) {

            if (logoutBtn) logoutBtn.style.display = 'none';
            if (loginBtnProfile) loginBtnProfile.style.display = 'inline-block';
            if (adminMenuLink) adminMenuLink.style.display = 'none';
        } else {

            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (loginBtnProfile) loginBtnProfile.style.display = 'none';
            
            // Show admin menu link if user is admin
            if (adminMenuLink) {
                adminMenuLink.style.display = (this.currentUser.isAdmin || this.currentUser.is_admin) ? 'flex' : 'none';
            }
        }

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

        this.updateAchievements();

        this.updateFriends();

        this.updateWishlists();

        this.updateReviews();
        
        // Show user section when user is logged in
        this.hideSignInButton();
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
        
        // Show nav buttons when user logs out
        const nav = document.querySelector('.nav');
        if (nav) {
            nav.classList.remove('user-hidden');
            nav.style.display = 'flex'; // Restore display
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
        const signInBtnGuest = document.getElementById('signInBtnGuest');
        const nav = document.querySelector('.nav');
        
        if (authSection) {
            authSection.style.display = 'none';
        }
        
        if (userSection) {
            userSection.style.display = 'block';
        }
        
        // Update profile links to use username-specific route
        if (this.currentUser && this.currentUser.username && !this.currentUser.isGuest) {
            const username = this.currentUser.username;
            
            // Update nav profile link
            const navProfileLink = document.querySelector('.nav .nav-btn[href="/profile"]');
            if (navProfileLink) {
                navProfileLink.href = `/profile/${username}`;
            }
            
            // Update dropdown profile link
            const dropdownProfileLink = document.querySelector('.profile-menu-item[href="/profile"]');
            if (dropdownProfileLink) {
                dropdownProfileLink.href = `/profile/${username}`;
            }
        }
        
        // Show Sign In button for guests, hide for registered users
        if (signInBtnGuest) {
            // Check if user is a guest - check both isGuest flag and username
            const isGuest = this.currentUser && (this.currentUser.isGuest === true || this.currentUser.username === 'Guest');
            if (isGuest) {
                signInBtnGuest.style.display = 'inline-block';
                signInBtnGuest.style.visibility = 'visible';
                // Add click handler to open login modal (same as regular signInBtn)
                signInBtnGuest.onclick = () => {
                    if (this.loginScreen) {
                        this.loginScreen.show();
                        this.loginScreen.resetToInitialState();
                    } else if (this.showLoginModal) {
                        this.showLoginModal();
                    } else {
                        const loginModal = document.getElementById('loginModal');
                        if (loginModal) {
                            loginModal.style.display = 'block';
                        }
                    }
                };
            } else {
                signInBtnGuest.style.display = 'none';
            }
        } else {
            console.warn('signInBtnGuest element not found in header');
        }
        
        // Hide nav buttons when user is logged in (they're in the dropdown)
        // Do this immediately to prevent flicker
        if (nav) {
            nav.classList.add('user-hidden');
            nav.style.display = 'none'; // Also set inline style for immediate effect
        }
        
        if (userDisplayName && this.currentUser) {
            userDisplayName.textContent = this.currentUser.username;
        }
        
        // Ensure nav stays hidden and button visibility after a short delay
        setTimeout(() => {
            if (nav && this.currentUser) {
                nav.classList.add('user-hidden');
                nav.style.display = 'none';
            }
            if (signInBtnGuest && this.currentUser) {
                const isGuest = this.currentUser && (this.currentUser.isGuest === true || this.currentUser.username === 'Guest');
                if (isGuest) {
                    signInBtnGuest.style.display = 'inline-block';
                    signInBtnGuest.style.visibility = 'visible';
                } else {
                    signInBtnGuest.style.display = 'none';
                }
            }
        }, 100);
    }

    updateAchievements() {
        const container = document.getElementById('achievementsList');
        if (!container) {
            return;
        }
        
        container.innerHTML = '';

        if (!this.currentUser.achievements || !Array.isArray(this.currentUser.achievements) || this.currentUser.achievements.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>No Achievements Yet</h3>
                    <p>Start gaming to unlock achievements!</p>
                </div>
            `;
            return;
        }

        if (this.currentUser.achievements && Array.isArray(this.currentUser.achievements)) {
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

        if (!modal || !modalBody) {
            console.error('Friend profile modal not found');
            return;
        }

        // Optional: show more info if available
        modalBody.innerHTML = `
            <p>Friend profile will load here.</p>
            <p>Username: ${friend.username}</p>
            <p>Friend since: ${friend.acceptedDate || 'N/A'}</p>
        `;

        // Show the modal
        modal.style.display = 'block';
    }


    updateLibraries() {
        const container = document.getElementById('libraryContainer');
        if (!container) {
            return;
        }
        
        if (!this.currentUser || !this.currentUser.username) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><h3>Login Required</h3><p>Please log in to view your libraries!</p></div>';
            return;
        }

        console.log('Fetching libraries for user:', this.currentUser.username);
        
        fetch(`/api/wishlists/${this.currentUser.username}`, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(async response => {
            console.log('Libraries API response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Libraries API error response:', errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText || 'Failed to load libraries' };
                }
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response.json();
        })
        .then(data => {
            console.log('Libraries API response data:', data);
            
            const container = document.getElementById('libraryContainer');
            if (!container) {
                return;
            }
            
            if (data.success && Array.isArray(data.wishlists)) {
                const libraries = data.wishlists || [];
                
                container.innerHTML = '';

                if (libraries.length === 0) {
                    container.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><h3>No Libraries</h3><p>Create your first library!</p></div>';
                } else {
                    // Create a grid container for libraries if it doesn't exist
                    if (!container.classList.contains('libraries-grid')) {
                        container.classList.add('libraries-grid');
                    }
                    
                    libraries.forEach(library => {
                        const libraryItem = document.createElement('div');
                        libraryItem.className = 'library-card';
                        const typeBadge = library.type === 'automatic' ? '<span class="badge badge-primary">Default</span>' :
                                         library.type === 'wishlist' ? '<span class="badge badge-warning">Wishlist</span>' : '';
                        const canEdit = library.type === 'custom';
                        libraryItem.innerHTML = `
                            <div class="library-card-header">
                                <h3>${library.name}</h3>
                                ${typeBadge}
                            </div>
                            <div class="library-card-body">
                                <div class="library-info">
                                    <p class="library-game-count"><i class="fas fa-gamepad"></i> ${library.gameCount || 0} games</p>
                                    ${library.description ? `<p class="library-description">${library.description}</p>` : ''}
                                    <p class="library-date"><i class="fas fa-calendar"></i> Created: ${new Date(library.createdDate).toLocaleDateString()}</p>
                                </div>
                                <div class="library-card-actions">
                                    <button class="btn btn-primary" onclick="app.selectLibrary(${library.id})">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                    ${canEdit ? `
                                        <button class="btn btn-secondary btn-sm" onclick="app.editLibrary(${library.id}, '${library.name.replace(/'/g, "\\'")}', '${(library.description || '').replace(/'/g, "\\'")}')">
                                            <i class="fas fa-edit"></i> Edit
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="app.deleteLibrary(${library.id})">
                                            <i class="fas fa-trash"></i> Delete
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                        container.appendChild(libraryItem);
                    });
                }
            } else {
                console.error('Invalid response format:', data);
                const errorMsg = data.error || 'Failed to load libraries. Please try again.';
                container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${errorMsg}</p></div>`;
            }
        })
        .catch(error => {
            console.error('Error fetching libraries:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });
            const container = document.getElementById('libraryContainer');
            if (container) {
                const errorMsg = error.message || 'Failed to load libraries. Please try again.';
                container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${errorMsg}</p></div>`;
            }
        });
    }

    // Alias for backward compatibility
    updateWishlists() {
        this.updateLibraries();
    }

    updateReviews() {
        const container = document.getElementById('reviewsContainer');
        if (!container) {
            return;
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

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

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

        // Set current avatar preview
        const avatarPreview = document.getElementById('avatarPreview');
        const avatarPreviewPlaceholder = document.getElementById('avatarPreviewPlaceholder');
        const removeAvatarBtn = document.getElementById('removeAvatarBtn');
        const editAvatarInput = document.getElementById('editAvatarInput');
        
        if (avatarPreview && avatarPreviewPlaceholder) {
            const currentAvatar = this.currentUser.avatar_path || (document.getElementById('profileAvatarImg')?.src || '');
            if (currentAvatar && !currentAvatar.includes('ui-avatars.com')) {
                avatarPreview.src = currentAvatar;
                avatarPreview.style.display = 'block';
                avatarPreviewPlaceholder.style.display = 'none';
                if (removeAvatarBtn) removeAvatarBtn.style.display = 'inline-block';
            } else {
                avatarPreview.style.display = 'none';
                avatarPreviewPlaceholder.style.display = 'flex';
                if (removeAvatarBtn) removeAvatarBtn.style.display = 'none';
            }
        }
        
        // Reset file input
        if (editAvatarInput) {
            editAvatarInput.value = '';
        }

        const editProfileModal = document.getElementById('editProfileModal');
        if (editProfileModal) {
            editProfileModal.style.display = 'block';
        }
    }

    async saveProfile() {
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

        // Upload avatar first if a new file is selected
        const editAvatarInput = document.getElementById('editAvatarInput');
        const removeAvatarBtn = document.getElementById('removeAvatarBtn');

        // Check if avatar should be removed
        let shouldRemoveAvatar = false;
        if (removeAvatarBtn && removeAvatarBtn.style.display === 'inline-block') {
            const avatarPreview = document.getElementById('avatarPreview');
            if (avatarPreview && avatarPreview.style.display === 'none') {
                shouldRemoveAvatar = true;
            }
        }

        // Upload avatar first if a new file is selected
        if (editAvatarInput && editAvatarInput.files && editAvatarInput.files.length > 0) {
            try {
                const formData = new FormData();
                formData.append('avatar', editAvatarInput.files[0]);

                const avatarResponse = await fetch('/api/profile/avatar', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                const avatarData = await avatarResponse.json();
                
                if (!avatarResponse.ok || !avatarData.success) {
                    this.showAlert(avatarData.error || 'Failed to upload avatar', 'Upload Failed', 'error');
                    return;
                }

                // Update current user with new avatar path
                if (avatarData.avatar_path) {
                    this.currentUser.avatar_path = avatarData.avatar_path;
                    // Update session if available
                    if (window.app && window.app.currentUser) {
                        window.app.currentUser.avatar_path = avatarData.avatar_path;
                    }
                }
            } catch (error) {
                console.error('Error uploading avatar:', error);
                this.showAlert('Failed to upload avatar. Please try again.', 'Upload Failed', 'error');
                return;
            }
        }

        // Update profile information
        fetch(`/api/profile/${this.currentUser.username}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(updates)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.currentUser.bio = bio;
                this.currentUser.gamingPreferences = updates.gamingPreferences;
                
                // Update avatar image on page if it was changed
                if (this.currentUser.avatar_path) {
                    const profileAvatarImg = document.getElementById('profileAvatarImg');
                    if (profileAvatarImg) {
                        profileAvatarImg.src = this.currentUser.avatar_path;
                    }
                }
                
                this.closeModal(document.getElementById('editProfileModal'));
                this.updateUI();
                this.showAlert('Profile updated successfully!', 'Success', 'success');
                
                // Reload page to show updated avatar
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
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

    async createLibrary(name, description) {
        if (!name) {
            this.showAlert('Please enter a library name', 'Library Name Required', 'warning');
            return false;
        }

        if (!this.currentUser) {
            this.showAlert('Please log in to create a library', 'Login Required', 'warning');
            return false;
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

            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                let errorMessage = 'Failed to create library';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If response isn't valid JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                this.showAlert(errorMessage, 'Error', 'error');
                return false;
            }

            const data = await response.json();

            if (data.success) {
                this.updateLibraries();
                this.showNotification('Library created successfully!', 'success');
                return true;
            } else {
                this.showAlert(data.error || 'Failed to create library', 'Error', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error creating library:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            
            // Handle network errors specifically
            if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
                this.showAlert('Failed to connect to server. Please check your internet connection and try again.', 'Connection Error', 'error');
            } else if (error.message) {
                this.showAlert('Error creating library: ' + error.message, 'Error', 'error');
            } else {
                this.showAlert('Error creating library. Please try again.', 'Error', 'error');
            }
            return false;
        }
    }

    async updateLibrary(libraryId, name, description) {
        if (!name) {
            this.showAlert('Please enter a library name', 'Library Name Required', 'warning');
            return false;
        }

        if (!this.currentUser) {
            this.showAlert('Please log in to update a library', 'Login Required', 'warning');
            return false;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/${libraryId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description || ''
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.updateLibraries();
                this.showNotification('Library updated successfully!', 'success');
                return true;
            } else {
                this.showAlert(data.error || 'Failed to update library', 'Error', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error updating library:', error);
            this.showAlert('Error updating library. Please try again.', 'Error', 'error');
            return false;
        }
    }

    async deleteLibrary(libraryId) {
        if (!this.currentUser) {
            this.showAlert('Please log in to delete a library', 'Login Required', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to delete this library? All games in it will be removed.')) {
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/${libraryId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.updateLibraries();
                this.showNotification('Library deleted successfully!', 'success');
            } else {
                this.showAlert(data.error || 'Failed to delete library', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error deleting library:', error);
            this.showAlert('Error deleting library. Please try again.', 'Error', 'error');
        }
    }

    editLibrary(libraryId, name, description) {
        if (typeof openEditLibraryModal === 'function') {
            openEditLibraryModal(libraryId, name, description);
        } else {
            // Fallback if modal functions aren't available
            const newName = prompt('Enter new library name:', name);
            if (newName && newName !== name) {
                this.updateLibrary(libraryId, newName, description);
            }
        }
    }

    // Backward compatibility
    async createWishlist() {
        const name = document.getElementById('wishlistName')?.value || document.getElementById('libraryName')?.value;
        const description = document.getElementById('wishlistDescription')?.value || document.getElementById('libraryDescription')?.value;
        return await this.createLibrary(name, description);
    }

    async selectLibrary(libraryId) {
        if (!this.currentUser) {
            this.showAlert('Please log in to view libraries', 'Login Required', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/${libraryId}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                const container = document.getElementById('libraryGames');
                const title = document.getElementById('selectedLibraryTitle');
                const selectedSection = document.getElementById('selectedLibrarySection');
                const libraryContainer = document.getElementById('libraryContainer');
                
                // Show selected library section, hide libraries list
                if (selectedSection) {
                    selectedSection.style.display = 'block';
                }
                // Hide the libraries container
                if (libraryContainer) {
                    libraryContainer.style.display = 'none';
                }
                
                if (title) {
                    title.textContent = `${data.wishlist.name} Games`;
                }

                if (container) {
                    container.innerHTML = '';

                    if (!data.games || data.games.length === 0) {
                        container.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><h3>No Games</h3><p>Add some games to this library!</p></div>';
                        return;
                    }

                    data.games.forEach(game => {
                        const gameItem = document.createElement('div');
                        gameItem.className = 'friend-item';
                        // Use game.title (from API) or game.gameTitle as fallback
                        const gameTitle = game.title || game.gameTitle || 'Unknown Game';
                        const gameIdToRemove = game.gameId || game.steamId || game.id;
                        gameItem.innerHTML = `
                            <div>
                                <strong>${gameTitle}</strong>
                                <br>
                                <small>${game.platform || 'PC'} • Added: ${new Date(game.addedDate).toLocaleDateString()}</small>
                            </div>
                            <button class="btn btn-danger" onclick="app.removeFromLibrary(${libraryId}, ${gameIdToRemove})">Remove</button>
                        `;
                        container.appendChild(gameItem);
                    });
                }
            } else {
                this.showAlert(data.error || 'Failed to load library', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error loading library:', error);
            this.showAlert('Error loading library. Please try again.', 'Error', 'error');
        }
    }

    backToLibraries() {
        const selectedSection = document.getElementById('selectedLibrarySection');
        const libraryContainer = document.getElementById('libraryContainer');
        
        if (selectedSection) {
            selectedSection.style.display = 'none';
        }
        // Show the libraries container
        if (libraryContainer) {
            libraryContainer.style.display = 'block';
        }
        this.updateLibraries();
    }

    async removeFromLibrary(libraryId, gameId) {
        if (!this.currentUser) {
            this.showAlert('Please log in to manage libraries', 'Login Required', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this game from the library?')) {
            return;
        }

        try {
            // Try to remove by gameId first, then by steamId if gameId doesn't work
            let response = await fetch(`/api/wishlists/${this.currentUser.username}/${libraryId}/games/${gameId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // If that fails, try removing by steamId
            if (!response.ok && gameId) {
                response = await fetch(`/api/wishlists/${this.currentUser.username}/remove-game`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        wishlistId: libraryId,
                        gameId: gameId,
                        steamId: gameId // Try steamId as well
                    })
                });
            }

            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification(data.message || 'Game removed from library', 'success');
                this.selectLibrary(libraryId); // Refresh the library view
                this.updateLibraries(); // Update the libraries list
            } else {
                this.showAlert(data.error || 'Failed to remove game from library', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error removing game from library:', error);
            this.showAlert('Error removing game from library. Please try again.', 'Error', 'error');
        }
    }

    // Backward compatibility
    async selectWishlist(wishlistId) {
        return await this.selectLibrary(wishlistId);
    }


    // Backward compatibility
    async removeFromWishlist(wishlistId, gameId) {
        return await this.removeFromLibrary(wishlistId, gameId);
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
                    document.getElementById('editGameTitle').dataset.appid = review.gameId || '';
                    document.getElementById('editRating').value = review.rating;
                    document.getElementById('editReviewText').value = review.reviewText;
                    document.getElementById('editTags').value = review.tags ? review.tags.join(', ') : '';
                    document.getElementById('editReviewPublic').checked = review.isPublic;
                    
                    this.loadPublicReviewsForGame(review.gameTitle);
                    
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

        fetch('/api/admin/stats')
        .then(response => response.json())
        .then(data => {
            const adminStatus = document.getElementById('adminStatus');
            if (data.isAdmin) {
                if (adminStatus) {
                    adminStatus.innerHTML = '<span class="badge badge-success">Admin</span>';
                }
                this.loadAdminPanel();
            } else {
                if (adminStatus) {
                    adminStatus.innerHTML = '<span class="badge badge-warning">Not Admin</span>';
                }
                this.showAlert('You must be an admin to access this panel', 'Access Denied', 'warning');
            }
        })
        .catch(error => {
            console.error('Error checking admin status:', error);
        });
    }

    setupAdminTabs() {
        const tabs = document.querySelectorAll('.admin-tab');
        const tabContents = document.querySelectorAll('.admin-tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(tc => tc.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                const targetContent = document.getElementById(targetTab + 'Tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // Load data for the active tab
                if (targetTab === 'users') {
                    this.loadUsers();
                } else if (targetTab === 'admins') {
                    this.loadAdmins();
                } else if (targetTab === 'logs') {
                    this.loadLogs();
                }
            });
        });

        // Setup admin panel buttons
        const refreshUsersBtn = document.getElementById('refreshUsersBtn');
        if (refreshUsersBtn) {
            refreshUsersBtn.addEventListener('click', () => this.loadUsers());
        }

        const refreshLogsBtn = document.getElementById('refreshLogsBtn');
        if (refreshLogsBtn) {
            refreshLogsBtn.addEventListener('click', () => this.loadLogs());
        }

        const createAdminBtn = document.getElementById('createAdminBtn');
        if (createAdminBtn) {
            createAdminBtn.addEventListener('click', () => {
                const modal = document.getElementById('createAdminModal');
                if (modal) modal.style.display = 'block';
            });
        }

        // Setup create admin form
        const createAdminForm = document.getElementById('createAdminForm');
        if (createAdminForm) {
            createAdminForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createAdmin();
            });
        }

        const cancelCreateAdmin = document.getElementById('cancelCreateAdmin');
        if (cancelCreateAdmin) {
            cancelCreateAdmin.addEventListener('click', () => {
                const modal = document.getElementById('createAdminModal');
                if (modal) modal.style.display = 'none';
                createAdminForm.reset();
            });
        }

        // Close modal on X click
        const createAdminModal = document.getElementById('createAdminModal');
        if (createAdminModal) {
            const closeBtn = createAdminModal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    createAdminModal.style.display = 'none';
                    createAdminForm.reset();
                });
            }
        }
    }

    loadAdminPanel() {
        this.loadStats();
        this.loadUsers();
        this.loadAdmins();
        this.loadLogs();
    }

    loadStats() {
        fetch('/api/admin/stats', {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.userStats) {
            const stats = data.userStats;
            const container = document.getElementById('adminStats');
                if (container) {
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
                        <div class="stat-card">
                            <i class="fas fa-shield-alt"></i>
                            <h3>${stats.totalAdmins || 0}</h3>
                            <p>Admins</p>
                </div>
            `;
                }
            }
        })
        .catch(error => {
            console.error('Error fetching admin stats:', error);
        });
    }

    loadUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading users...</td></tr>';

        fetch('/api/admin/users', {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.users) {
                if (data.users.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="empty">No users found</td></tr>';
                    return;
                }

                tbody.innerHTML = '';
                data.users.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.id}</td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${new Date(user.joinDate).toLocaleDateString()}</td>
                        <td>
                            <span class="badge ${user.isActive ? 'badge-success' : 'badge-danger'}">
                                ${user.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            ${user.isAdmin ? '<span class="badge badge-info">Admin</span>' : '<span class="badge badge-secondary">User</span>'}
                        </td>
                        <td>
                            <div class="action-buttons">
                                ${!user.isAdmin ? `
                                    <button class="btn-sm btn-primary" onclick="window.app.toggleUserStatus(${user.id}, ${user.isActive})" title="${user.isActive ? 'Deactivate' : 'Activate'}">
                                        <i class="fas fa-${user.isActive ? 'ban' : 'check'}"></i>
                                    </button>
                                    <button class="btn-sm ${user.isAdmin ? 'btn-info' : 'btn-success'}" onclick="window.app.promoteUser('${user.username}')" title="Promote to Admin">
                                        <i class="fas fa-user-shield"></i>
                                    </button>
                                    <button class="btn-sm btn-danger" onclick="window.app.deleteUser(${user.id}, '${user.username}')" title="Delete User">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : `
                                    <button class="btn-sm btn-warning" onclick="window.app.demoteAdmin('${user.username}')" title="Demote from Admin">
                                        <i class="fas fa-user-minus"></i>
                                    </button>
                                `}
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="7" class="error">Failed to load users</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error fetching users:', error);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" class="error">Error loading users</td></tr>';
            }
        });
    }

    loadAdmins() {
        const tbody = document.getElementById('adminsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading admins...</td></tr>';

        fetch('/api/admin/list', {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.admins) {
                if (data.admins.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="empty">No admins found</td></tr>';
                    return;
                }

                tbody.innerHTML = '';
                data.admins.forEach(admin => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${admin.id}</td>
                        <td>${admin.username}</td>
                        <td>${admin.email}</td>
                        <td>${new Date(admin.joinDate).toLocaleDateString()}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-sm btn-warning" onclick="window.app.demoteAdmin('${admin.username}')" title="Demote from Admin">
                                    <i class="fas fa-user-minus"></i> Demote
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="error">Failed to load admins</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error fetching admins:', error);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5" class="error">Error loading admins</td></tr>';
            }
        });
    }

    loadLogs() {
        const container = document.getElementById('systemLogs');
        if (!container) return;

        container.innerHTML = '<div class="loading">Loading system logs...</div>';

        fetch('/api/admin/logs', {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.logs) {
                if (data.logs.length === 0) {
                    container.innerHTML = '<div class="empty">No system logs available</div>';
                    return;
                }

                container.innerHTML = '';
                data.logs.slice(-50).reverse().forEach(log => {
                const logItem = document.createElement('div');
                logItem.className = 'log-item';
                logItem.innerHTML = `
                    <strong>${log.action}</strong>: ${log.details}
                    <br>
                    <small>${new Date(log.timestamp).toLocaleString()}</small>
                `;
                    container.appendChild(logItem);
            });
            } else {
                container.innerHTML = '<div class="error">Failed to load system logs</div>';
            }
        })
        .catch(error => {
            console.error('Error fetching logs:', error);
            container.innerHTML = '<div class="error">Error loading system logs</div>';
        });
    }

    createAdmin() {
        const username = document.getElementById('newAdminUsername').value;
        const email = document.getElementById('newAdminEmail').value;
        const password = document.getElementById('newAdminPassword').value;

        if (!username || !email || !password) {
            this.showAlert('Please fill in all fields', 'Validation Error', 'warning');
            return;
        }

        fetch('/api/admin/create', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showAlert(`Admin ${username} created successfully!`, 'Success', 'success');
                const modal = document.getElementById('createAdminModal');
                if (modal) modal.style.display = 'none';
                document.getElementById('createAdminForm').reset();
                this.loadAdmins();
                this.loadStats();
            } else {
                this.showAlert(data.error || 'Failed to create admin', 'Error', 'error');
            }
        })
        .catch(error => {
            console.error('Error creating admin:', error);
            this.showAlert('Error creating admin. Please try again.', 'Error', 'error');
        });
    }

    toggleUserStatus(userId, currentStatus) {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) {
            return;
        }

        fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isActive: !currentStatus })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showAlert(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`, 'Success', 'success');
                this.loadUsers();
                this.loadStats();
            } else {
                this.showAlert(data.error || 'Failed to update user status', 'Error', 'error');
            }
        })
        .catch(error => {
            console.error('Error updating user status:', error);
            this.showAlert('Error updating user status. Please try again.', 'Error', 'error');
        });
    }

    deleteUser(userId, username) {
        if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
            return;
        }

        fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showAlert(`User ${username} deleted successfully`, 'Success', 'success');
                this.loadUsers();
                this.loadStats();
            } else {
                this.showAlert(data.error || 'Failed to delete user', 'Error', 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting user:', error);
            this.showAlert('Error deleting user. Please try again.', 'Error', 'error');
        });
    }

    promoteUser(username) {
        if (!confirm(`Are you sure you want to promote "${username}" to admin?`)) {
            return;
        }

        fetch(`/api/admin/promote/${username}`, {
            method: 'POST',
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showAlert(`User ${username} promoted to admin successfully`, 'Success', 'success');
                this.loadUsers();
                this.loadAdmins();
                this.loadStats();
            } else {
                this.showAlert(data.error || 'Failed to promote user', 'Error', 'error');
            }
        })
        .catch(error => {
            console.error('Error promoting user:', error);
            this.showAlert('Error promoting user. Please try again.', 'Error', 'error');
        });
    }

    demoteAdmin(username) {
        if (!confirm(`Are you sure you want to demote "${username}" from admin?`)) {
            return;
        }

        fetch(`/api/admin/demote/${username}`, {
            method: 'POST',
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showAlert(`User ${username} demoted from admin successfully`, 'Success', 'success');
                this.loadUsers();
                this.loadAdmins();
                this.loadStats();
            } else {
                this.showAlert(data.error || 'Failed to demote admin', 'Error', 'error');
            }
        })
        .catch(error => {
            console.error('Error demoting admin:', error);
            this.showAlert('Error demoting admin. Please try again.', 'Error', 'error');
        });
    }

    updateAdminPanel() {
        // Legacy method for backward compatibility
        this.loadAdminPanel();
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
            this.showAlert('Please enter a search term', 'Search Required', 'warning');
            return;
        }

        console.log('Redirecting to search page with query:', query);

        window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }

    async searchGames(query, page = 1) {
        try {
            this.showSearchLoading();

            console.log('Searching for:', query);
            const response = await fetch(`/api/games/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=20`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Search API error:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Search response:', data);

            if (data.success && data.games) {
                this.displaySearchResults(
                    data.games, 
                    data.totalResults || data.games.length, 
                    data.currentPage || page, 
                    data.totalPages || Math.ceil((data.totalResults || data.games.length) / 20) || 1, 
                    query
                );
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

        document.getElementById('searchTitle').textContent = `Search Results for "${query}" (${totalResults} games found)`;

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
                            `<a href="steam:
                                <i class="fab fa-steam"></i> Play on Steam
                            </a>` : 
                            `                            <button class="btn btn-secondary" onclick="app.handleAddToLibrary(${game.id}, '${game.name}')">
                                <i class="fas fa-book"></i> Add to Library
                            </button>`
                        }
                    </div>
                </div>
            `;
            resultsContainer.appendChild(gameCard);
        });

        this.displaySearchPagination(currentPage, totalPages, query);
    }

    displaySearchPagination(currentPage, totalPages, query) {
        const paginationContainer = document.getElementById('searchPagination');
        paginationContainer.innerHTML = '';

        if (totalPages <= 1) return;

        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        if (currentPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn btn-secondary';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
            prevBtn.onclick = () => this.searchGames(query, currentPage - 1);
            pagination.appendChild(prevBtn);
        }

        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => this.searchGames(query, i);
            pagination.appendChild(pageBtn);
        }

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
                        <button class="btn btn-primary" onclick="app.handleAddToLibrary(${gameData.id}, '${gameData.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-book"></i> Add to Library
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="app.showLoginModal()">
                            <i class="fas fa-sign-in-alt"></i> Login to Add to Library
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

    async addToLibrary(gameId, gameName) {
        if (!this.currentUser) {
            this.showAlert('Please log in to add games to your library', 'Login Required', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/add-game`, {
                method: 'POST',
                credentials: 'include', // Important: include session cookies
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
                this.showAlert(`Added "${gameName}" to library!`, 'Success', 'success');
            } else {
                this.showAlert('Failed to add game to library: ' + result.error, 'Error', 'error');
            }
        } catch (error) {
            console.error('Error adding game to library:', error);
            this.showAlert('Error adding game to library', 'Error', 'error');
        }
    }

    async addToLibraryWithId(gameId, gameName, libraryId) {
        if (!this.currentUser) {
            this.showAlert('Please log in to add games to your library', 'Login Required', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}/add-game`, {
                method: 'POST',
                credentials: 'include', // Important: include session cookies
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gameId: gameId,
                    gameName: gameName,
                    wishlistId: libraryId,
                    gameData: {
                        addedDate: new Date().toISOString()
                    }
                })
            });

            if (!response.ok) {
                let errorMessage = 'Failed to add game to library';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = response.statusText || errorMessage;
                }
                this.showAlert(errorMessage, 'Error', 'error');
                return;
            }

            const result = await response.json();

            if (result.success) {
                this.showAlert(`Added "${gameName}" to library!`, 'Success', 'success');
                // Close library selection modal if open
                const selectionModal = document.getElementById('librarySelectionModal');
                if (selectionModal) {
                    selectionModal.style.display = 'none';
                }
                // Refresh library view if on library page
                if (window.location.pathname.includes('/library') || window.location.pathname.includes('/wishlist')) {
                    if (this.updateLibraries) {
                        this.updateLibraries();
                    }
                }
            } else {
                this.showAlert('Failed to add game to library: ' + (result.error || 'Unknown error'), 'Error', 'error');
            }
        } catch (error) {
            console.error('Error adding game to library:', error);
            this.showAlert('Error adding game to library: ' + (error.message || 'Please try again'), 'Error', 'error');
        }
    }

    showLibrarySelectionModal(gameId, gameName, libraries) {
        // Create or update library selection modal
        let selectionModal = document.getElementById('librarySelectionModal');
        if (!selectionModal) {
            selectionModal = document.createElement('div');
            selectionModal.id = 'librarySelectionModal';
            selectionModal.className = 'modal';
            document.body.appendChild(selectionModal);
        }

        selectionModal.innerHTML = `
            <div class="modal-content wishlist-selection-content">
                <span class="close" onclick="app.closeLibrarySelectionModal()">&times;</span>
                <h2>Add "${gameName}" to Library</h2>
                <p class="wishlist-selection-subtitle">Choose which library to add this game to:</p>
                <div class="wishlist-list">
                    ${libraries.map(library => `
                        <div class="wishlist-item" onclick="app.addToLibraryWithId(${gameId}, '${gameName.replace(/'/g, "\\'")}', ${library.id})">
                            <div class="wishlist-item-info">
                                <h3>${library.name} ${library.type === 'automatic' ? '<span class="badge badge-primary">Default</span>' : library.type === 'wishlist' ? '<span class="badge badge-warning">Wishlist</span>' : ''}</h3>
                                ${library.description ? `<p>${library.description}</p>` : ''}
                                <span class="wishlist-item-meta">
                                    ${library.gameCount || 0} ${library.gameCount === 1 ? 'game' : 'games'}
                                    ${library.isPublic ? '<i class="fas fa-globe" title="Public"></i>' : '<i class="fas fa-lock" title="Private"></i>'}
                                </span>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    `).join('')}
                </div>
                <div class="wishlist-selection-actions">
                    <button class="btn btn-secondary" onclick="app.closeLibrarySelectionModal()">Cancel</button>
                </div>
            </div>
        `;

        selectionModal.style.display = 'block';
    }

    closeLibrarySelectionModal() {
        const selectionModal = document.getElementById('librarySelectionModal');
        if (selectionModal) {
            selectionModal.style.display = 'none';
        }
    }

    // Backward compatibility
    async addToWishlist(gameId, gameName) {
        return await this.addToLibrary(gameId, gameName);
    }

    // Backward compatibility
    async addToWishlistWithId(gameId, gameName, wishlistId) {
        return await this.addToLibraryWithId(gameId, gameName, wishlistId);
    }

    // Backward compatibility
    showWishlistSelectionModal(gameId, gameName, wishlists) {
        return this.showLibrarySelectionModal(gameId, gameName, wishlists);
    }

    closeWishlistSelectionModal() {
        return this.closeLibrarySelectionModal();
    }

    async handleAddToLibrary(gameId, gameName) {
        if (!this.currentUser) {
            this.showAlert('Please log in to add games to your library', 'Login Required', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/wishlists/${this.currentUser.username}`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            const libraries = data.success ? (data.wishlists || []) : [];

            if (libraries.length === 0) {
                // No libraries, create default and add
                await this.addToLibrary(gameId, gameName);
            } else if (libraries.length === 1) {
                // Only one library, add directly
                await this.addToLibraryWithId(gameId, gameName, libraries[0].id);
            } else {
                // Multiple libraries, show selection modal
                this.showLibrarySelectionModal(gameId, gameName, libraries);
            }
        } catch (error) {
            console.error('Error handling add to library:', error);
            // Fallback to default behavior
            await this.addToLibrary(gameId, gameName);
        }
    }

    // Backward compatibility
    async handleAddToWishlist(gameId, gameName) {
        return await this.handleAddToLibrary(gameId, gameName);
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

    initializeReviewsPage() {
        const section = document.getElementById('reviewsSection');
        if (!section) {
            return;
        }

        if (this.reviewState.initialized) {
            return;
        }

        this.reviewState.initialized = true;
        this.reviewState.page = 1;
        this.reviewState.filters = {
            search: '',
            rating: 'all',
            visibility: 'all',
            tags: [],
            sort: 'newest'
        };

        const searchInput = document.getElementById('reviewsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.reviewState.filters.search = e.target.value.trim();
                this.reviewState.page = 1;
                this.applyReviewFilters();
            });
        }

        const sortSelect = document.getElementById('reviewsSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.reviewState.filters.sort = e.target.value;
                this.reviewState.page = 1;
                this.applyReviewFilters();
            });
        }

        const ratingFilter = document.getElementById('reviewsRatingFilter');
        if (ratingFilter) {
            ratingFilter.addEventListener('change', (e) => {
                this.reviewState.filters.rating = e.target.value;
                this.reviewState.page = 1;
                this.applyReviewFilters();
            });
        }

        const visibilityFilter = document.getElementById('reviewsVisibilityFilter');
        if (visibilityFilter) {
            visibilityFilter.addEventListener('change', (e) => {
                this.reviewState.filters.visibility = e.target.value;
                this.reviewState.page = 1;
                this.applyReviewFilters();
            });
        }

        const tagInput = document.getElementById('reviewsTagFilter');
        if (tagInput) {
            tagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = e.target.value.trim();
                    if (value) {
                        const normalized = value.toLowerCase();
                        if (!this.reviewState.filters.tags.includes(normalized)) {
                            this.reviewState.filters.tags.push(normalized);
                            this.reviewState.page = 1;
                            this.applyReviewFilters();
                        }
                        e.target.value = '';
                    }
                }
            });
        }

        const resetFiltersBtn = document.getElementById('reviewsResetFilters');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.resetReviewFilters();
            });
        }

        const publicClearBtn = document.getElementById('publicReviewsClear');
        if (publicClearBtn) {
            publicClearBtn.addEventListener('click', () => {
                this.clearPublicReviewPreview();
            });
        }

        const prevPageBtn = document.getElementById('reviewsPrevPage');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (this.reviewState.page > 1) {
                    this.reviewState.page -= 1;
                    this.renderReviewPagination();
                    this.renderReviewList();
                }
            });
        }

        const nextPageBtn = document.getElementById('reviewsNextPage');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (this.reviewState.page < this.reviewState.totalPages) {
                    this.reviewState.page += 1;
                    this.renderReviewPagination();
                    this.renderReviewList();
                }
            });
        }

        this.setupReviewAutocomplete('reviewGameTitle', 'addReviewGameSuggestions');
        this.setupReviewAutocomplete('editGameTitle', 'editReviewGameSuggestions');

        this.updateReviews();
    }

    resetReviewFilters() {
        this.reviewState.filters = {
            search: '',
            rating: 'all',
            visibility: 'all',
            tags: [],
            sort: 'newest'
        };

        const searchInput = document.getElementById('reviewsSearch');
        if (searchInput) searchInput.value = '';
        const sortSelect = document.getElementById('reviewsSort');
        if (sortSelect) sortSelect.value = 'newest';
        const ratingFilter = document.getElementById('reviewsRatingFilter');
        if (ratingFilter) ratingFilter.value = 'all';
        const visibilityFilter = document.getElementById('reviewsVisibilityFilter');
        if (visibilityFilter) visibilityFilter.value = 'all';
        const tagInput = document.getElementById('reviewsTagFilter');
        if (tagInput) tagInput.value = '';

        this.reviewState.page = 1;
        this.applyReviewFilters();
    }

    setReviewsLoading(isLoading) {
        this.reviewState.loading = isLoading;
        const loadingState = document.getElementById('reviewsLoadingState');
        const list = document.getElementById('reviewsList');
        const emptyState = document.getElementById('reviewsEmptyState');
        if (loadingState) {
            loadingState.style.display = isLoading ? 'flex' : 'none';
        }
        if (list && isLoading) {
            list.innerHTML = '';
        }
        if (emptyState && isLoading) {
            emptyState.style.display = 'none';
        }
    }

    applyReviewFilters() {
        if (!this.reviewState.initialized) {
            return;
        }

        const { search, rating, visibility, tags, sort } = this.reviewState.filters;
        const searchLower = search.toLowerCase();
        let filtered = Array.from(this.reviewState.allReviews || []);

        if (search) {
            filtered = filtered.filter(review =>
                (review.gameTitle && review.gameTitle.toLowerCase().includes(searchLower)) ||
                (review.reviewText && review.reviewText.toLowerCase().includes(searchLower))
            );
        }

        if (rating !== 'all') {
            const minRating = parseInt(rating, 10);
            filtered = filtered.filter(review => review.rating >= minRating);
        }

        if (visibility === 'public') {
            filtered = filtered.filter(review => review.isPublic);
        } else if (visibility === 'private') {
            filtered = filtered.filter(review => !review.isPublic);
        }

        if (tags && tags.length > 0) {
            filtered = filtered.filter(review => {
                if (!review.tags || review.tags.length === 0) return false;
                const reviewTags = review.tags.map(tag => tag.toLowerCase());
                return tags.every(tag => reviewTags.includes(tag));
            });
        }

        switch (sort) {
            case 'oldest':
                filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'rating-desc':
                filtered.sort((a, b) => b.rating - a.rating);
                break;
            case 'rating-asc':
                filtered.sort((a, b) => a.rating - b.rating);
                break;
            case 'helpful':
                filtered.sort((a, b) => (b.helpfulVotes || 0) - (a.helpfulVotes || 0));
                break;
            case 'alpha':
                filtered.sort((a, b) => (a.gameTitle || '').localeCompare(b.gameTitle || ''));
                break;
            case 'newest':
            default:
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
        }

        this.reviewState.filteredReviews = filtered;
        this.reviewState.totalPages = Math.max(1, Math.ceil(filtered.length / this.reviewState.pageSize));

        if (this.reviewState.page > this.reviewState.totalPages) {
            this.reviewState.page = this.reviewState.totalPages;
        }
        if (this.reviewState.page < 1) {
            this.reviewState.page = 1;
        }

        this.renderActiveFilterChips();
        this.renderReviewPagination();
        this.renderReviewList();
        this.updateReviewStats();
    }

    renderReviewList() {
        const list = document.getElementById('reviewsList');
        const emptyState = document.getElementById('reviewsEmptyState');
        const pagination = document.getElementById('reviewsPagination');
        const loadingState = document.getElementById('reviewsLoadingState');

        if (!list) {
            return;
        }

        if (loadingState) {
            loadingState.style.display = this.reviewState.loading ? 'flex' : 'none';
        }

        if (this.reviewState.loading) {
            return;
        }

        list.innerHTML = '';

        const filtered = this.reviewState.filteredReviews || [];
        if (filtered.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            if (pagination) pagination.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        const startIndex = (this.reviewState.page - 1) * this.reviewState.pageSize;
        const endIndex = startIndex + this.reviewState.pageSize;
        const reviewsForPage = filtered.slice(startIndex, endIndex);

        reviewsForPage.forEach(review => {
            const card = document.createElement('article');
            card.className = 'review-card';
            card.innerHTML = this.buildReviewCard(review);
            list.appendChild(card);
        });
    }

    buildReviewCard(review) {
        const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const tags = review.tags && review.tags.length > 0
            ? `<div class="review-tags">${review.tags.map(tag => `<span class="tag-chip">${this.escapeHtml(tag)}</span>`).join('')}</div>`
            : '';
        const visibilityBadge = review.isPublic ? '' : '<span class="filter-chip"><i class="fas fa-lock"></i> Private</span>';
        const helpfulLabel = review.helpfulVotes === 1 ? 'helpful vote' : 'helpful votes';
        const helpfulActive = review.userHasVoted ? ' active' : '';
        const helpfulText = (review.helpfulVotes || 0) > 0 ? `${review.helpfulVotes} ${helpfulLabel}` : 'Be the first to mark helpful';

        return `
            <header class="review-card-header">
                <div>
                    <h3 class="review-game-title">${this.escapeHtml(review.gameTitle)}</h3>
                    <div class="review-rating">
                        <span class="rating-stars">${ratingStars}</span>
                        <span class="rating-number">${review.rating}/5</span>
                    </div>
                </div>
                <div class="review-card-actions">
                    ${visibilityBadge}
                </div>
            </header>
            <div class="review-text">${this.escapeHtml(review.reviewText)}</div>
            ${tags}
            <div class="review-meta">
                <span><i class="far fa-calendar"></i> ${this.formatDate(review.createdAt)}</span>
                <span><i class="far fa-clock"></i> Updated ${this.formatRelativeDate(review.updatedAt)}</span>
            </div>
            <footer class="review-card-actions">
                <div class="review-action-group">
                    <button class="btn-icon${helpfulActive}" onclick="app.toggleHelpfulVote(${review.id}, this)">
                        <i class="fas fa-thumbs-up"></i> ${this.escapeHtml(helpfulText)}
                    </button>
                </div>
                <div class="review-footer-buttons">
                    <button class="btn-icon secondary" onclick="app.copyReviewLink(${review.id})">
                        <i class="fas fa-share-alt"></i> Share
                    </button>
                    <button class="btn-icon" onclick="app.editReview(${review.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-icon danger" onclick="app.deleteReview(${review.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </footer>
        `;
    }

    renderActiveFilterChips() {
        const container = document.getElementById('reviewsActiveFilters');
        const tagChipRow = document.getElementById('activeTagChips');
        if (!container) {
            return;
        }

        const chips = [];
        const { search, rating, visibility, tags } = this.reviewState.filters;

        if (search) {
            chips.push(`<span class="filter-chip">Search: ${this.escapeHtml(search)} <i class="fas fa-times remove-chip" onclick="app.removeReviewFilter('search')"></i></span>`);
        }

        if (rating !== 'all') {
            chips.push(`<span class="filter-chip">Rating ≥ ${rating}★ <i class="fas fa-times remove-chip" onclick="app.removeReviewFilter('rating')"></i></span>`);
        }

        if (visibility !== 'all') {
            chips.push(`<span class="filter-chip">${visibility === 'public' ? 'Public only' : 'Private only'} <i class="fas fa-times remove-chip" onclick="app.removeReviewFilter('visibility')"></i></span>`);
        }

        if (tags && tags.length > 0) {
            tags.forEach(tag => {
                chips.push(`<span class="filter-chip">#${this.escapeHtml(tag)} <i class="fas fa-times remove-chip" onclick="app.removeReviewFilter('tag','${tag}')"></i></span>`);
            });
        }

        if (chips.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
        } else {
            container.style.display = 'flex';
            container.innerHTML = chips.join('');
        }

        if (tagChipRow) {
            if (tags && tags.length > 0) {
                tagChipRow.innerHTML = tags.map(tag => `<span class="tag-chip">#${this.escapeHtml(tag)} <i class="fas fa-times remove-chip" onclick="app.removeReviewFilter('tag','${tag}')"></i></span>`).join('');
            } else {
                tagChipRow.innerHTML = '';
            }
        }
    }

    setupReviewAutocomplete(inputId, suggestionsId) {
        const input = document.getElementById(inputId);
        const suggestionsContainer = document.getElementById(suggestionsId);
        if (!input || !suggestionsContainer) {
            return;
        }

        let debounceTimer = null;
        input.setAttribute('autocomplete', 'off');

        const hideSuggestions = () => {
            suggestionsContainer.style.display = 'none';
            suggestionsContainer.innerHTML = '';
        };

        const fetchSuggestions = (query) => {
            if (!query || query.length < 2) {
                hideSuggestions();
                return;
            }

            fetch(`/api/games/search?q=${encodeURIComponent(query)}&pageSize=6`, {
                method: 'GET',
                credentials: 'include'
            })
                .then(response => response.json())
                .then(result => {
                    if (!result || !result.success || !Array.isArray(result.games)) {
                        hideSuggestions();
                        return;
                    }
                    if (result.games.length === 0) {
                        hideSuggestions();
                        return;
                    }
                    this.renderGameSuggestions(suggestionsContainer, result.games, (game) => {
                        input.value = game.name;
                        input.dataset.appid = game.id || game.appid || '';
                        hideSuggestions();
                        this.loadPublicReviewsForGame(game.name);
                    });
                })
                .catch(error => {
                    console.error('Error fetching game suggestions:', error);
                    hideSuggestions();
                });
        };

        input.addEventListener('input', (event) => {
            const value = event.target.value.trim();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchSuggestions(value), 250);
        });

        input.addEventListener('focus', () => {
            if (input.value.trim()) {
                fetchSuggestions(input.value.trim());
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => hideSuggestions(), 180);
        });
    }

    renderGameSuggestions(container, games, onSelect) {
        container.innerHTML = games.map(game => {
            const meta = [];
            if (game.release_date || game.released) {
                meta.push(game.release_date || game.released);
            }
            if (game.platforms && game.platforms.length) {
                meta.push(game.platforms.map(p => p.name || p).join(', '));
            }
            return `
                <div class="suggestion-item" data-id="${game.id || game.appid || ''}" data-name="${this.escapeHtml(game.name)}">
                    <span class="suggestion-title">${this.escapeHtml(game.name)}</span>
                    <span class="suggestion-meta">${meta.map(item => this.escapeHtml(item)).join(' • ')}</span>
                </div>
            `;
        }).join('');

        Array.from(container.querySelectorAll('.suggestion-item')).forEach(item => {
            item.addEventListener('mousedown', (event) => {
                event.preventDefault();
                const game = {
                    id: item.dataset.id,
                    name: item.dataset.name
                };
                onSelect(game);
            });
        });

        container.style.display = 'block';
    }

    loadPublicReviewsForGame(gameName) {
        if (!gameName) {
            this.clearPublicReviewPreview();
            return;
        }

        const preview = document.getElementById('publicReviewsPreview');
        const list = document.getElementById('publicReviewsList');
        const title = document.getElementById('publicReviewsGameName');

        if (title) {
            title.textContent = gameName;
        }
        if (list) {
            list.innerHTML = '<p class="loading-text">Loading community feedback...</p>';
        }
        if (preview) {
            preview.style.display = 'flex';
        }

        fetch(`/api/reviews/public?game=${encodeURIComponent(gameName)}&pageSize=4`, {
            method: 'GET',
            credentials: 'include'
        })
            .then(response => response.json())
            .then(result => {
                if (!result || !result.success || !Array.isArray(result.reviews)) {
                    throw new Error(result && result.error ? result.error : 'No public reviews found');
                }
                this.renderPublicReviewPreview(gameName, result.reviews);
            })
            .catch(error => {
                console.error('Error loading public reviews:', error);
                if (list) {
                    list.innerHTML = `<p class="error-text">${this.escapeHtml(error.message || 'Failed to load community reviews.')}</p>`;
                }
            });
    }

    renderPublicReviewPreview(gameName, reviews) {
        const preview = document.getElementById('publicReviewsPreview');
        const list = document.getElementById('publicReviewsList');
        const title = document.getElementById('publicReviewsGameName');

        if (!preview || !list) {
            return;
        }

        if (title) {
            title.textContent = gameName;
        }

        if (!reviews || reviews.length === 0) {
            list.innerHTML = `<p class="empty-note">No public reviews available yet. Be the first to share your thoughts!</p>`;
            preview.style.display = 'flex';
            return;
        }

        list.innerHTML = reviews.map(review => {
            const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            return `
                <article class="public-review-card">
                    <header>
                        <div>
                            <strong>${this.escapeHtml(review.gameTitle)}</strong>
                            <div class="rating-stars">${ratingStars}</div>
                        </div>
                        <span><i class="far fa-user"></i> ${this.escapeHtml(review.user ? review.user.username : 'Anonymous')}</span>
                    </header>
                    <div class="review-text">${this.escapeHtml(review.reviewText)}</div>
                    <footer>
                        <span>${new Date(review.createdAt).toLocaleDateString()}</span>
                        <span><i class="fas fa-thumbs-up"></i> ${review.helpfulVotes || 0}</span>
                    </footer>
                </article>
            `;
        }).join('');

        preview.style.display = 'flex';
    }

    clearPublicReviewPreview() {
        const preview = document.getElementById('publicReviewsPreview');
        const list = document.getElementById('publicReviewsList');
        const title = document.getElementById('publicReviewsGameName');
        if (preview) {
            preview.style.display = 'none';
        }
        if (list) {
            list.innerHTML = '';
        }
        if (title) {
            title.textContent = '';
        }
    }

    removeReviewFilter(type, value = '') {
        switch (type) {
            case 'search':
                this.reviewState.filters.search = '';
                const searchInput = document.getElementById('reviewsSearch');
                if (searchInput) searchInput.value = '';
                break;
            case 'rating':
                this.reviewState.filters.rating = 'all';
                const ratingFilter = document.getElementById('reviewsRatingFilter');
                if (ratingFilter) ratingFilter.value = 'all';
                break;
            case 'visibility':
                this.reviewState.filters.visibility = 'all';
                const visibilityFilter = document.getElementById('reviewsVisibilityFilter');
                if (visibilityFilter) visibilityFilter.value = 'all';
                break;
            case 'tag':
                this.reviewState.filters.tags = this.reviewState.filters.tags.filter(tag => tag !== value);
                break;
            default:
                break;
        }
        this.reviewState.page = 1;
        this.applyReviewFilters();
    }

    renderReviewPagination() {
        const pagination = document.getElementById('reviewsPagination');
        const pageInfo = document.getElementById('reviewsPageInfo');

        if (!pagination || !pageInfo) {
            return;
        }

        if (this.reviewState.filteredReviews.length === 0) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = this.reviewState.totalPages > 1 ? 'flex' : 'none';
        pageInfo.textContent = `Page ${this.reviewState.page} of ${this.reviewState.totalPages}`;
    }

    updateReviewStats() {
        const totalEl = document.getElementById('reviewsTotal');
        const avgEl = document.getElementById('reviewsAverage');
        const publicEl = document.getElementById('reviewsPublicCount');
        const lastUpdatedEl = document.getElementById('reviewsLastUpdated');

        const reviews = this.reviewState.allReviews || [];

        if (totalEl) totalEl.textContent = reviews.length;

        const rated = reviews.filter(r => typeof r.rating === 'number');
        const avgRating = rated.length ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length : 0;
        if (avgEl) avgEl.textContent = avgRating.toFixed(1);

        const publicCount = reviews.filter(r => r.isPublic).length;
        if (publicEl) publicEl.textContent = publicCount;

        if (lastUpdatedEl) {
            if (reviews.length === 0) {
                lastUpdatedEl.textContent = '—';
            } else {
                const latest = reviews.reduce((latest, current) => {
                    const currentDate = new Date(current.updatedAt || current.createdAt);
                    return currentDate > latest ? currentDate : latest;
                }, new Date(0));
                lastUpdatedEl.textContent = latest > new Date(0) ? latest.toLocaleDateString() : '—';
            }
        }
    }

    formatDate(dateValue) {
        if (!dateValue) return 'Unknown';
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return 'Unknown';
        return date.toLocaleDateString();
    }

    formatRelativeDate(dateValue) {
        if (!dateValue) return 'Unknown';
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return 'Unknown';
        const diffMs = Date.now() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        const diffWeeks = Math.floor(diffDays / 7);
        if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        if (!text && text !== 0) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    copyReviewLink(reviewId) {
        if (!reviewId) return;
        const shareUrl = `${window.location.origin}/reviews/public/${reviewId}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl)
                .then(() => {
                    this.showNotification('Review link copied to clipboard!', 'success');
                })
                .catch(() => {
                    this.showAlert('Unable to copy link. Please try again.', 'Copy Failed', 'error');
                });
        } else {
            const tempInput = document.createElement('input');
            tempInput.value = shareUrl;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            this.showNotification('Review link copied to clipboard!', 'success');
        }
    }

    toggleHelpfulVote(reviewId, button = null) {
        if (!this.currentUser) {
            this.showAlert('Please log in to mark reviews helpful.', 'Login Required', 'warning');
            return;
        }

        const review = this.reviewState.allReviews.find(r => r.id === reviewId);
        if (!review) return;

        const hasVoted = !!review.userHasVoted;
        const method = hasVoted ? 'DELETE' : 'POST';

        if (button) {
            button.disabled = true;
        }

        fetch(`/api/reviews/${reviewId}/helpful`, {
            method,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(async response => {
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Unable to update helpful vote.');
                }
                review.userHasVoted = !hasVoted;
                review.helpfulVotes = result.helpfulVotes !== undefined
                    ? result.helpfulVotes
                    : (review.helpfulVotes || 0) + (hasVoted ? -1 : 1);
                this.applyReviewFilters();
                this.showNotification(result.message || 'Thanks for your feedback!', 'success');
            })
            .catch(error => {
                console.error('Error toggling helpful vote:', error);
                this.showAlert(error.message || 'Unable to update helpful vote. Please try again.', 'Error', 'error');
            })
            .finally(() => {
                if (button) {
                    button.disabled = false;
                }
            });
    }

    updateReviews() {
        const section = document.getElementById('reviewsSection');
        if (!section) {
            return;
        }

        if (!this.currentUser) {
            const list = document.getElementById('reviewsList');
            const emptyState = document.getElementById('reviewsEmptyState');
            const pagination = document.getElementById('reviewsPagination');
            if (list) list.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'flex';
                const heading = emptyState.querySelector('h3');
                const description = emptyState.querySelector('p');
                if (heading) heading.textContent = 'Login Required';
                if (description) description.textContent = 'Please sign in to see and manage your reviews.';
            }
            if (pagination) pagination.style.display = 'none';
            this.clearPublicReviewPreview();
            return;
        }

        this.setReviewsLoading(true);

        fetch('/api/reviews', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                this.setReviewsLoading(false);

                if (!data || !data.success) {
                    throw new Error(data && data.error ? data.error : 'Failed to load reviews');
                }

                const reviews = (data.reviews || []).map(review => ({
                    ...review,
                    tags: Array.isArray(review.tags) ? review.tags : [],
                    userHasVoted: !!review.userHasVoted
                }));

                this.reviewState.allReviews = reviews;
                this.reviewState.page = 1;
                this.applyReviewFilters();
            })
            .catch(error => {
                console.error('Error fetching reviews:', error);
                const list = document.getElementById('reviewsList');
                const emptyState = document.getElementById('reviewsEmptyState');
                this.setReviewsLoading(false);
                if (list) list.innerHTML = '';
                if (emptyState) {
                    emptyState.style.display = 'flex';
                    const heading = emptyState.querySelector('h3');
                    const description = emptyState.querySelector('p');
                    if (heading) heading.textContent = 'Error loading reviews';
                    if (description) description.textContent = error.message || 'Failed to load reviews. Please try again.';
                }
                const pagination = document.getElementById('reviewsPagination');
                if (pagination) pagination.style.display = 'none';
            });
    }
}

class SteamIntegration {
    constructor() {
        this.steamLinked = false;
        this.steamProfile = null;
    }

    async initializeSteamIntegration() {
        try {

            const username = this.getUsernameFromUrl();
            if (!username) {
                console.error('Username not found in URL');
                return;
            }
            
            const response = await fetch(`/api/auth/steam/status/${username}`);
            const status = await response.json();
            
            if (status.linked) {
                this.steamLinked = true;
                this.steamProfile = status.steam_profile;
                this.showSteamProfile();
                this.loadSteamGames();
                
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('steam_auth') === 'success') {

                    const newUrl = window.location.pathname + window.location.search.replace(/[?&]steam_auth=success/, '');
                    window.history.replaceState({}, '', newUrl);
                    
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

            const username = this.getUsernameFromUrl();
            if (!username) {
                if (window.app) {
                    window.app.showAlert('Username not found in URL', 'Error', 'error');
                } else {
                    alert('Username not found in URL');
                }
                return;
            }
            
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
                    alert(`Successfully imported ${gamesCount} games from Steam!`);

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

        const pathParts = window.location.pathname.split('/');
        const profileIndex = pathParts.indexOf('profile');
        if (profileIndex !== -1 && pathParts[profileIndex + 1]) {
            return pathParts[profileIndex + 1];
        }
        return null;
    }

    async loadSteamGames() {
        try {

            const username = this.getUsernameFromUrl();
            if (!username) {
                console.error('Username not found in URL');
                return;
            }
            
            console.log('[App] Fetching Steam games for:', username);
            const response = await fetch(`/api/steam/games/${username}`, {
                credentials: 'include'
            });
            
            console.log('[App] Steam games response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[App] Error fetching Steam games:', errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText || 'Failed to fetch Steam games' };
                }
                console.error('[App] Steam games error:', errorData.error || errorData.message);
                // Don't throw - just log the error and continue
                return;
            }
            
            const result = await response.json();
            console.log('[App] Steam games result:', result);
            
            if (result.success) {

                const steamGameCount = document.getElementById('steamGameCount');
                if (steamGameCount) {
                    steamGameCount.textContent = result.games ? result.games.length : 0;
                }

                let totalPlaytime = 0;
                let totalAchievements = 0;
                
                if (result.games && result.games.length > 0) {
                    totalPlaytime = result.games.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);

                    totalAchievements = result.games.reduce((sum, game) => sum + (game.achievements || 0), 0);
                }

                const totalGames = document.getElementById('totalGames');
                const totalPlaytimeElement = document.getElementById('totalPlaytime');
                const achievementCount = document.getElementById('achievementCount');
                
                if (totalGames) {
                    totalGames.textContent = result.games ? result.games.length : 0;
                }
                if (totalPlaytimeElement) {
                    totalPlaytimeElement.textContent = Math.round(totalPlaytime / 60);
                }
                if (achievementCount) {
                    achievementCount.textContent = totalAchievements;
                }

                await this.loadSiteRatings();
            }
        } catch (error) {
            console.error('Error loading Steam games:', error);
        }
    }

    async loadSiteRatings() {
        try {

            const response = await fetch('/api/reviews/current-user');
            const result = await response.json();
            
            if (result.success && result.reviews) {

                const ratings = result.reviews.filter(review => review.rating > 0).map(review => review.rating);
                const avgRating = ratings.length > 0 ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 0;
                
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

let app;
let steamIntegration;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing GameVaultApp');
    app = new GameVaultApp();
    window.app = app;
    
    steamIntegration = new SteamIntegration();
    window.steamIntegration = steamIntegration;
    
    setTimeout(() => {
        console.log('Testing search elements after initialization:');
        console.log('Search button:', document.getElementById("gameSearchBtn"));
        console.log('Search input:', document.getElementById("gameSearchInput"));
        console.log('Global functions available:', typeof window.performSearch, typeof window.testSearch);
        
        if (steamIntegration) {
            steamIntegration.initializeSteamIntegration();
        }
    }, 500);
});

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

