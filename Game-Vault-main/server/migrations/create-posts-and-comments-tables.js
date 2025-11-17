const { sequelize } = require('../config/database');

module.exports = {
    up: async () => {
        try {
            // Create posts table
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    "userId" INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    title VARCHAR(200) NOT NULL,
                    content TEXT NOT NULL,
                    "gameTitle" VARCHAR(200),
                    category VARCHAR(50) NOT NULL DEFAULT 'general',
                    tags JSONB DEFAULT '[]'::jsonb,
                    likes INTEGER NOT NULL DEFAULT 0,
                    views INTEGER NOT NULL DEFAULT 0,
                    "isPinned" BOOLEAN NOT NULL DEFAULT false,
                    "isLocked" BOOLEAN NOT NULL DEFAULT false,
                    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    CONSTRAINT posts_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
                    CONSTRAINT posts_content_length CHECK (char_length(content) >= 10 AND char_length(content) <= 10000)
                );
            `);

            // Create comments table
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS comments (
                    id SERIAL PRIMARY KEY,
                    "postId" INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                    "userId" INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    "parentCommentId" INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                    likes INTEGER NOT NULL DEFAULT 0,
                    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    CONSTRAINT comments_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000)
                );
            `);

            // Create indexes
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_posts_userId ON posts("userId");
                CREATE INDEX IF NOT EXISTS idx_posts_gameTitle ON posts("gameTitle");
                CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
                CREATE INDEX IF NOT EXISTS idx_posts_createdAt ON posts("createdAt");
                CREATE INDEX IF NOT EXISTS idx_comments_postId ON comments("postId");
                CREATE INDEX IF NOT EXISTS idx_comments_userId ON comments("userId");
                CREATE INDEX IF NOT EXISTS idx_comments_parentCommentId ON comments("parentCommentId");
                CREATE INDEX IF NOT EXISTS idx_comments_createdAt ON comments("createdAt");
            `);

            console.log('✅ Posts and Comments tables created successfully');
        } catch (error) {
            console.error('❌ Error creating posts and comments tables:', error);
            throw error;
        }
    },

    down: async () => {
        try {
            await sequelize.query('DROP TABLE IF EXISTS comments CASCADE;');
            await sequelize.query('DROP TABLE IF EXISTS posts CASCADE;');
            console.log('✅ Posts and Comments tables dropped successfully');
        } catch (error) {
            console.error('❌ Error dropping posts and comments tables:', error);
            throw error;
        }
    }
};

