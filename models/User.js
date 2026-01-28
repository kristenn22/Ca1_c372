const db = require('../db');

module.exports = {
  createUser: (user) => {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
      db.query(sql, [user.username, user.email, user.password, user.address, user.contact, user.role], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  findByEmailAndPassword: (email, password) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
      db.query(sql, [email, password], (err, results) => {
        if (err) return reject(err);
        resolve(results[0]);
      });
    });
  },

  getAll: () => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, username, email, role, contact, address FROM users ORDER BY id DESC';
      db.query(sql, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },

  getCount: () => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM users';
      db.query(sql, (err, results) => {
        if (err) {
          console.error('Error getting user count:', err);
          return reject(err);
        }
        const count = results && results[0] ? results[0].count : 0;
        resolve(count);
      });
    });
  }
};
