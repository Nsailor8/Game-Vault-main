const { sequelize } = require('../config/database');

/**
 * Migration: Add profile_picture_path column to users table
 * This migration adds the profile_picture_path column if it doesn't exist
 */
async function addProfilePictureColumn() {
    try {
        console.log('Checking if profile_picture_path column exists...');
        
        // Check if column exists
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='profile_picture_path';
        `);
        
        if (results.length === 0) {
            console.log('Adding profile_picture_path column to users table...');
            
            // Add the column
            await sequelize.query(`
                ALTER TABLE users 
                ADD COLUMN profile_picture_path VARCHAR(255) DEFAULT '';
            `);
            
            console.log('✅ Successfully added profile_picture_path column');
        } else {
            console.log('✅ profile_picture_path column already exists');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error adding profile_picture_path column:', error);
        return false;
    }
}

// Run migration if called directly
if (require.main === module) {
    addProfilePictureColumn()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = addProfilePictureColumn;

