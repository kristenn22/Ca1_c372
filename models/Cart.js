const db = require('../db');

/**
 * Provides simple persistence for user carts so they survive logout/login cycles.
 * Each cart item is tied to a user and references the product id; name/price/image
 * are re-fetched from the products table to keep data fresh.
 */
module.exports = {
  // Get the current cart items for a user (with product details)
  getCart: (userId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ci.productId,
          ci.quantity,
          p.productName,
          p.price,
          p.image
        FROM cart_items ci
        LEFT JOIN products p ON p.id = ci.productId
        WHERE ci.userId = ?
      `;

      db.query(sql, [userId], (err, rows) => {
        if (err) return reject(err);

        const items = (rows || []).map(row => ({
          id: row.productId,
          name: row.productName || 'Product unavailable',
          price: row.price || 0,
          image: row.image || 'placeholder.png',
          quantity: row.quantity
        }));

        resolve(items);
      });
    });
  },

  // Insert or update a cart item quantity
  upsertItem: (userId, productId, quantity) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO cart_items (userId, productId, quantity)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
      `;

      db.query(sql, [userId, productId, quantity], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  // Remove a single product from the user's cart
  removeItem: (userId, productId) => {
    return new Promise((resolve, reject) => {
      db.query(
        'DELETE FROM cart_items WHERE userId = ? AND productId = ?',
        [userId, productId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  },

  // Clear the user's cart entirely
  clearCart: (userId) => {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM cart_items WHERE userId = ?', [userId], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};
