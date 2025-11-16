const AdminManager = require('./client/profile.js').AdminManager;
const DatabaseManager = require('./server/database/DatabaseManager');

async function createAdmin() {
    console.log('🔧 Creating admin user...\n');
    
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    const adminManager = new AdminManager(dbManager);
    
    // Admin credentials - you can change these
    const username = 'admin';
    const email = 'admin@gamevault.com';
    const password = 'admin123';
    
    try {
        // Check if admin already exists
        const existingUser = await dbManager.getUserByUsername(username);
        if (existingUser) {
            if (existingUser.is_admin) {
                console.log(`✅ Admin user "${username}" already exists and is an admin!`);
                console.log(`   Email: ${existingUser.email}`);
                console.log(`   You can login with username: ${username}`);
                console.log(`   Password: (use the password you set for this user)`);
                console.log('\n💡 If you forgot the password, you can create a new admin with a different username.');
                await dbManager.close();
                return;
            } else {
                // Promote existing user to admin
                console.log(`⚠️  User "${username}" exists but is not an admin. Promoting to admin...`);
                await adminManager.promoteToAdmin(username);
                console.log(`✅ User "${username}" has been promoted to admin!`);
                console.log(`   You can login with username: ${username}`);
                console.log(`   Password: (use the password you set for this user)`);
                await dbManager.close();
                return;
            }
        }
        
        // Create new admin using AdminManager
        const admin = await adminManager.createAdmin(username, email, password);
        
        console.log('✅ Admin user created successfully!\n');
        console.log('📋 Admin Credentials:');
        console.log(`   Username: ${username}`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log('\n⚠️  Please change the password after first login!');
        console.log('\n🌐 You can now login at: http://localhost:3000/admin');
        
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.log('\n💡 The username or email already exists. Try a different username/email.');
        }
        process.exit(1);
    } finally {
        await dbManager.close();
    }
    
    process.exit(0);
}

createAdmin().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

