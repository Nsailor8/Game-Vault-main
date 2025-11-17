const { sequelize } = require('../config/database');

async function up() {
    const queryInterface = sequelize.getQueryInterface();
    
    // Change rating column from INTEGER to DECIMAL(2,1) to support half stars
    try {
        // Check if we're using PostgreSQL
        const dialect = sequelize.getDialect();
        
        if (dialect === 'postgres') {
            // PostgreSQL: Use ALTER COLUMN
            await sequelize.query(`
                ALTER TABLE reviews 
                ALTER COLUMN rating TYPE DECIMAL(2,1);
            `);
        } else {
            // SQLite or other: Use changeColumn
            await queryInterface.changeColumn('reviews', 'rating', {
                type: sequelize.Sequelize.DECIMAL(2, 1),
                allowNull: false
            });
        }
        
        console.log('✅ Updated rating column to DECIMAL(2,1) to support half stars');
    } catch (error) {
        if (error.message.includes('does not exist') || error.message.includes('Unknown column')) {
            console.log('⚠️  Rating column does not exist, skipping...');
        } else if (error.message.includes('already') || error.message.includes('duplicate')) {
            console.log('⚠️  Rating column already updated, skipping...');
        } else {
            console.error('⚠️  Error updating rating column:', error.message);
            // Don't throw - allow migration to continue
        }
    }
}

async function down() {
    const queryInterface = sequelize.getQueryInterface();
    
    // Revert rating column back to INTEGER
    try {
        const dialect = sequelize.getDialect();
        
        if (dialect === 'postgres') {
            await sequelize.query(`
                ALTER TABLE reviews 
                ALTER COLUMN rating TYPE INTEGER;
            `);
        } else {
            await queryInterface.changeColumn('reviews', 'rating', {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false
            });
        }
        
        console.log('✅ Reverted rating column back to INTEGER');
    } catch (error) {
        console.log('⚠️  Error reverting rating column:', error.message);
    }
}

module.exports = { up, down };

