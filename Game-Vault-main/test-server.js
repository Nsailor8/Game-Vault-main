#!/usr/bin/env node

/**
 * Comprehensive Server Functionality Test Suite
 * Tests all major endpoints and features of the Game Vault server
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_USERNAME = `testuser_${Date.now()}`;
const TEST_EMAIL = `test_${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPassword123!';

let sessionCookie = '';
let testUserId = null;
let testUsername = TEST_USERNAME;

// Test results
const results = {
    passed: 0,
    failed: 0,
    errors: []
};

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, cookies = '') {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies
            }
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsed,
                        cookies: res.headers['set-cookie'] || []
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body,
                        cookies: res.headers['set-cookie'] || []
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Extract session cookie from response
function extractSessionCookie(response) {
    if (response.cookies && response.cookies.length > 0) {
        // Try to find connect.sid cookie
        for (const cookie of response.cookies) {
            if (cookie.includes('connect.sid')) {
                return cookie.split(';')[0];
            }
        }
        // If no connect.sid, use the first cookie
        return response.cookies[0].split(';')[0];
    }
    // Also check if cookie is in the response body or headers
    if (response.headers && response.headers['set-cookie']) {
        const cookies = Array.isArray(response.headers['set-cookie']) 
            ? response.headers['set-cookie'] 
            : [response.headers['set-cookie']];
        for (const cookie of cookies) {
            if (cookie.includes('connect.sid')) {
                return cookie.split(';')[0];
            }
        }
    }
    return '';
}

// Test function wrapper
async function test(name, testFn) {
    try {
        console.log(`\n🧪 Testing: ${name}`);
        await testFn();
        results.passed++;
        console.log(`✅ PASSED: ${name}`);
    } catch (error) {
        results.failed++;
        results.errors.push({ test: name, error: error.message });
        console.log(`❌ FAILED: ${name}`);
        console.log(`   Error: ${error.message}`);
    }
}

// ==================== AUTHENTICATION TESTS ====================

async function testSignup() {
    const response = await makeRequest('POST', '/api/auth/signup', {
        username: testUsername,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        gamingPreferences: {}
    });
    
    if (response.status !== 200 || !response.body.success) {
        throw new Error(`Signup failed: ${JSON.stringify(response.body)}`);
    }
    
    sessionCookie = extractSessionCookie(response);
    if (!sessionCookie) {
        console.log(`   ⚠ Warning: No session cookie received, but signup succeeded`);
        console.log(`   Response cookies: ${JSON.stringify(response.cookies)}`);
    } else {
        console.log(`   ✓ Session cookie received: ${sessionCookie.substring(0, 30)}...`);
    }
    
    console.log(`   ✓ User created: ${testUsername}`);
}

async function testLogin() {
    const response = await makeRequest('POST', '/api/auth/login', {
        username: testUsername,
        password: TEST_PASSWORD
    });
    
    if (response.status !== 200 || !response.body.success) {
        throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
    }
    
    sessionCookie = extractSessionCookie(response);
    if (!sessionCookie) {
        throw new Error('No session cookie received after login');
    }
    
    console.log(`   ✓ Login successful`);
    console.log(`   ✓ Session cookie received`);
}

async function testAuthCheck() {
    const response = await makeRequest('GET', '/api/auth/check', null, sessionCookie);
    
    if (response.status !== 200 || !response.body.success) {
        throw new Error(`Auth check failed: ${JSON.stringify(response.body)}`);
    }
    
    if (!response.body.user || response.body.user.username !== testUsername) {
        throw new Error('Auth check returned wrong user');
    }
    
    console.log(`   ✓ Session is valid`);
    console.log(`   ✓ User data retrieved: ${response.body.user.username}`);
}

async function testAuthRefresh() {
    const response = await makeRequest('POST', '/api/auth/refresh', null, sessionCookie);
    
    if (response.status !== 200 || !response.body.success) {
        throw new Error(`Auth refresh failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Session refreshed`);
}

// ==================== PROFILE TESTS ====================

async function testGetProfile() {
    const response = await makeRequest('GET', `/api/profile/${testUsername}`, null, sessionCookie);
    
    if (response.status !== 200) {
        throw new Error(`Get profile failed: ${JSON.stringify(response.body)}`);
    }
    
    if (!response.body.username || response.body.username !== testUsername) {
        throw new Error('Profile returned wrong username');
    }
    
    console.log(`   ✓ Profile retrieved for: ${response.body.username}`);
}

async function testUpdateProfile() {
    const updates = {
        bio: 'Test bio updated',
        gamingPreferences: {
            favoriteGenres: ['Action', 'RPG'],
            preferredPlatforms: ['PC', 'PlayStation 5'],
            playStyle: 'casual'
        }
    };
    
    const response = await makeRequest('PUT', `/api/profile/${testUsername}`, updates, sessionCookie);
    
    if (response.status !== 200 || !response.body.success) {
        throw new Error(`Update profile failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Profile updated successfully`);
}

// ==================== FRIENDS TESTS ====================

async function testGetFriends() {
    const response = await makeRequest('GET', `/api/friends/${testUsername}`, null, sessionCookie);
    
    if (response.status !== 200) {
        throw new Error(`Get friends failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Friends list retrieved`);
}

// ==================== WISHLIST TESTS ====================

async function testGetWishlists() {
    const response = await makeRequest('GET', `/api/wishlists/${testUsername}`, null, sessionCookie);
    
    if (response.status !== 200) {
        throw new Error(`Get wishlists failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Wishlists retrieved`);
}

async function testCreateWishlist() {
    const wishlistData = {
        name: 'Test Wishlist',
        description: 'A test wishlist',
        isPublic: true
    };
    
    const response = await makeRequest('POST', `/api/wishlists/${testUsername}/create`, wishlistData, sessionCookie);
    
    if (response.status !== 200 || !response.body.success) {
        throw new Error(`Create wishlist failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Wishlist created: ${response.body.wishlist?.name || 'Unknown'}`);
}

// ==================== REVIEWS TESTS ====================

async function testGetReviews() {
    const response = await makeRequest('GET', '/api/reviews', null, sessionCookie);
    
    if (response.status !== 200) {
        throw new Error(`Get reviews failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Reviews retrieved`);
}

async function testGetCurrentUserReviews() {
    const response = await makeRequest('GET', '/api/reviews/current-user', null, sessionCookie);
    
    if (response.status !== 200) {
        throw new Error(`Get current user reviews failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Current user reviews retrieved`);
}

// ==================== GAME SEARCH TESTS ====================

async function testGameSearch() {
    const response = await makeRequest('GET', '/api/games/search?q=cyberpunk&page=1&pageSize=5', null, sessionCookie);
    
    if (response.status !== 200) {
        throw new Error(`Game search failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Game search completed`);
    if (response.body.games && response.body.games.length > 0) {
        console.log(`   ✓ Found ${response.body.games.length} games`);
    }
}

// ==================== STEAM TESTS ====================

async function testSteamStatus() {
    const response = await makeRequest('GET', `/api/auth/steam/status/${testUsername}`, null, sessionCookie);
    
    if (response.status !== 200) {
        throw new Error(`Steam status check failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Steam status retrieved`);
}

// ==================== PAGE ROUTES TESTS ====================

async function testPageRoute(route, name) {
    const response = await makeRequest('GET', route, null, sessionCookie);
    
    if (response.status !== 200) {
        throw new Error(`${name} page failed with status ${response.status}`);
    }
    
    console.log(`   ✓ ${name} page loaded`);
}

// ==================== LOGOUT TEST ====================

async function testLogout() {
    const response = await makeRequest('POST', '/api/auth/logout', null, sessionCookie);
    
    if (response.status !== 200 || !response.body.success) {
        throw new Error(`Logout failed: ${JSON.stringify(response.body)}`);
    }
    
    console.log(`   ✓ Logout successful`);
}

// ==================== MAIN TEST RUNNER ====================

async function runAllTests() {
    console.log('🚀 Starting Comprehensive Server Functionality Tests');
    console.log('=' .repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Test Username: ${testUsername}`);
    console.log('=' .repeat(60));

    // Authentication Tests
    await test('User Signup', testSignup);
    await test('User Login', testLogin);
    await test('Auth Check', testAuthCheck);
    await test('Auth Refresh', testAuthRefresh);

    // Profile Tests
    await test('Get Profile', testGetProfile);
    await test('Update Profile', testUpdateProfile);

    // Friends Tests
    await test('Get Friends', testGetFriends);

    // Wishlist Tests
    await test('Get Wishlists', testGetWishlists);
    await test('Create Wishlist', testCreateWishlist);

    // Reviews Tests
    await test('Get Reviews', testGetReviews);
    await test('Get Current User Reviews', testGetCurrentUserReviews);

    // Game Search Tests
    await test('Game Search', testGameSearch);

    // Steam Tests
    await test('Steam Status', testSteamStatus);

    // Page Routes Tests
    await test('Home Page', () => testPageRoute('/', 'Home'));
    await test('Profile Page', () => testPageRoute(`/profile/${testUsername}`, 'Profile'));
    await test('Search Page', () => testPageRoute('/search', 'Search'));
    await test('Library Page', () => testPageRoute('/library', 'Library'));
    await test('Wishlist Page', () => testPageRoute('/wishlist', 'Wishlist'));
    await test('Friends Page', () => testPageRoute('/friends', 'Friends'));
    await test('Reviews Page', () => testPageRoute('/reviews', 'Reviews'));
    await test('Settings Page', () => testPageRoute('/settings', 'Settings'));

    // Cleanup
    await test('User Logout', testLogout);

    // Print Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    if (results.errors.length > 0) {
        console.log('\n❌ FAILED TESTS:');
        results.errors.forEach(({ test, error }) => {
            console.log(`   - ${test}: ${error}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});

