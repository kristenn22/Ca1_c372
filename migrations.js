const mysql = require('mysql2');

// Create database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const migrations = {
    initializeTables: function() {
        // Create order_status_tracking table if it doesn't exist
        const createOrderStatusTable = `
            CREATE TABLE IF NOT EXISTS order_status_tracking (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL UNIQUE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
        `;

        db.query(createOrderStatusTable, (err, results) => {
            if (err) {
                console.error('Error creating order_status_tracking table:', err);
                return;
            }
            console.log('order_status_tracking table initialized or already exists');
        });

        // Add other table initializations as needed
    }
};

module.exports = migrations;
