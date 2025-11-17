const { sequelize } = require('../config/database');

async function up() {
    const queryInterface = sequelize.getQueryInterface();
    
    // Add isApproved column if it doesn't exist
    try {
        await queryInterface.addColumn('reviews', 'isApproved', {
            type: sequelize.Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
        console.log('✅ Added isApproved column to reviews table');
    } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log('⚠️  isApproved column already exists, skipping...');
        } else {
            throw error;
        }
    }
    
    // Add intendedPublic column if it doesn't exist
    try {
        await queryInterface.addColumn('reviews', 'intendedPublic', {
            type: sequelize.Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
        console.log('✅ Added intendedPublic column to reviews table');
    } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log('⚠️  intendedPublic column already exists, skipping...');
        } else {
            throw error;
        }
    }
}

async function down() {
    const queryInterface = sequelize.getQueryInterface();
    
    try {
        await queryInterface.removeColumn('reviews', 'isApproved');
        console.log('✅ Removed isApproved column from reviews table');
    } catch (error) {
        console.log('⚠️  Error removing isApproved column:', error.message);
    }
    
    try {
        await queryInterface.removeColumn('reviews', 'intendedPublic');
        console.log('✅ Removed intendedPublic column from reviews table');
    } catch (error) {
        console.log('⚠️  Error removing intendedPublic column:', error.message);
    }
}

module.exports = { up, down };

