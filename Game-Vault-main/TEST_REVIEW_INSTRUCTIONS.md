# Testing Review Creation and Admin Pending Reviews

## Manual Testing Steps

Since automated testing has cookie/session issues, please test manually in your browser:

### Step 1: Create a Public Review

1. **Log in as a regular user** (not admin):
   - Go to `http://localhost:3000`
   - Click "Sign In"
   - Log in with any user account (or create a new one)

2. **Navigate to Reviews page**:
   - Click on "Reviews" in the navigation

3. **Create a new review**:
   - Click "Add Review" button
   - Fill in the form:
     - **Game Title**: "Test Game - Cyberpunk 2077" (or any game name)
     - **Rating**: Select 5 stars
     - **Review Text**: "This is a test review to verify the admin pending reviews functionality. The game is amazing and I highly recommend it!"
     - **Tags**: "action, RPG, cyberpunk" (optional)
     - **✅ Check "Make this review public"** (IMPORTANT!)
   - Click "Submit Review"

4. **Verify the message**:
   - You should see a message: "Review submitted successfully! Your review is pending admin approval before it can be made public."

### Step 2: Check Admin Pending Reviews

1. **Log out** from the regular user account

2. **Log in as admin**:
   - Go to `http://localhost:3000/admin`
   - Enter username: `admin`
   - Enter password: `admin123`
   - Click "Login as Admin"

3. **Navigate to Pending Reviews**:
   - Click on the "PENDING REVIEWS" tab in the admin panel

4. **Verify the review appears**:
   - You should see your test review in the pending reviews list
   - It should show:
     - Game Title: "Test Game - Cyberpunk 2077"
     - Rating: 5 stars
     - Review text
     - Tags (if you added them)
     - "Approve" and "Reject" buttons

### Step 3: Test Approval

1. **Approve the review**:
   - Click the "Approve" button on your test review
   - Confirm the action
   - The review should disappear from the pending list

2. **Verify it's now public**:
   - Log out as admin
   - Log back in as the regular user
   - Go to the Reviews page
   - The review should now appear in your reviews list as "Public"

## Expected Behavior

- ✅ Public reviews are created with `isPublic: false` and `isApproved: false`
- ✅ Public reviews have `intendedPublic: true` to track user's intent
- ✅ Only reviews with `intendedPublic: true` AND `isApproved: false` appear in admin pending reviews
- ✅ After approval, `isApproved: true` and `isPublic: true` (if intendedPublic was true)
- ✅ After rejection, `isApproved: false` and `isPublic: false`

## Troubleshooting

If the review doesn't appear in pending reviews:

1. Check the browser console for errors
2. Verify you checked "Make this review public" when creating it
3. Check the server logs for any errors
4. Verify the admin login was successful (check for admin badge in top right)

