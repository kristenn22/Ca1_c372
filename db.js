const mysql = require('mysql2');
require('dotenv').config(); // Load variables from .env

//Database connection details
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

//Connecting to database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');

    // Ensure cart persistence table exists (idempotent, avoid duplicate FK names)
    const cartTable = 'cart_items';
    db.query('SHOW TABLES LIKE ?', [cartTable], (existsErr, rows) => {
        if (existsErr) {
            console.error('Failed to check cart table:', existsErr);
            return;
        }
        if (rows && rows.length) {
            console.log('user_cart_items table already present');
            return;
        }

        const createCartTableSql = `
            CREATE TABLE ${cartTable} (
                userId INT NOT NULL,
                productId INT NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (userId, productId),
                CONSTRAINT fk_cart_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_cart_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
            )
        `;

        db.query(createCartTableSql, (tableErr) => {
            if (tableErr) {
                console.error('Failed to ensure user_cart_items table exists:', tableErr);
            } else {
                console.log('user_cart_items table is ready');
            }
        });
    });
});

module.exports = db;
