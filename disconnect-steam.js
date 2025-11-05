const DatabaseManager = require('./Game-Vault-main/server/database/DatabaseManager');
const { User } = require('./Game-Vault-main/server/models/index');

async function disconnectSteam() {
    console.log('🔧 Disconnecting Steam from nsailor8 profile...\n');
    
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    const username = 'nsailor8';
    
    try {
        // Find the user
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            console.log(`❌ User "${username}" not found in database.`);
            await dbManager.close();
            process.exit(1);
        }
        
        // Check if Steam is linked
        if (!user.steam_id) {
            console.log(`ℹ️  User "${username}" does not have a Steam account linked.`);
            await dbManager.close();
            process.exit(0);
        }
        
        console.log(`✅ Found user "${username}"`);
        console.log(`   Current Steam ID: ${user.steam_id}`);
        console.log(`   Steam linked at: ${user.steam_linked_at || 'N/A'}`);
        console.log(`   Steam games count: ${user.steam_games ? (Array.isArray(user.steam_games) ? user.steam_games.length : 'N/A') : 0}`);
        
        // Disconnect Steam account
        user.steam_id = null;
        user.steam_profile = null;
        user.steam_linked_at = null;
        user.steam_games = null;
        user.steam_last_sync = null;
        
        await user.save();
        
        console.log('\n✅ Steam account disconnected successfully!');
        console.log(`   User "${username}" no longer has Steam linked.`);
        
    } catch (error) {
        console.error('❌ Error disconnecting Steam:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await dbManager.close();
    }
    
    process.exit(0);
}

disconnectSteam().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

