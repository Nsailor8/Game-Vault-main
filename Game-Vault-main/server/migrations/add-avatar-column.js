const { sequelize } = require('../config/database');

/**
 * Migration: Add avatar_path column to users table
 * This migration adds the avatar_path column if it doesn't exist
 */
async function addAvatarColumn() {
    try {
        console.log('Checking if avatar_path column exists...');
        
        // Check if column exists
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='avatar_path';
        `);
        
        if (results.length === 0) {
            console.log('Adding avatar_path column to users table...');
            
            // Add the column
            await sequelize.query(`
                ALTER TABLE users 
                ADD COLUMN avatar_path VARCHAR(255) DEFAULT NULL;
            `);
            
            console.log('✅ Successfully added avatar_path column');
        } else {
            console.log('✅ avatar_path column already exists');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error adding avatar_path column:', error);
        return false;
    }
}

// Run migration if called directly
if (require.main === module) {
    addAvatarColumn()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = addAvatarColumn;

