const { sequelize } = require('../config/database');

async function up() {
    const queryInterface = sequelize.getQueryInterface();
    
    // Add rejectionReason column if it doesn't exist
    try {
        await queryInterface.addColumn('reviews', 'rejectionReason', {
            type: sequelize.Sequelize.TEXT,
            allowNull: true
        });
        console.log('✅ Added rejectionReason column to reviews table');
    } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log('⚠️  rejectionReason column already exists, skipping...');
        } else {
            throw error;
        }
    }
}

async function down() {
    const queryInterface = sequelize.getQueryInterface();
    
    try {
        await queryInterface.removeColumn('reviews', 'rejectionReason');
        console.log('✅ Removed rejectionReason column from reviews table');
    } catch (error) {
        console.log('⚠️  Error removing rejectionReason column:', error.message);
    }
}

module.exports = { up, down };

