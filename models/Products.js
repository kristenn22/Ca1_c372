// models/Products.js
const db = require('../db');

module.exports = {

  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM products', (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },

  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
        if (err) return reject(err);
        resolve(results[0]);
      });
    });
  },

  getProductById: (id, callback) => {
    db.query('SELECT * FROM products WHERE id = ?', [id], callback);
  },

  add: (product) => {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
      db.query(sql, [product.name, product.quantity, product.price, product.image], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  update: (id, product) => {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?';
      db.query(sql, [product.name, product.quantity, product.price, product.image, id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM products WHERE id = ?', [id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

};
