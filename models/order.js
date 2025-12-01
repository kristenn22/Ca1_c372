const db = require("../db");

module.exports = {

  //create order
  createOrder: (userId, address, paymentMethod, subtotal, shipping, total) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO orders (userId, address, paymentMethod, subtotal, shipping, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(sql, [userId, address, paymentMethod, subtotal, shipping, total], (err, result) => {
        if (err) return reject(err);
        resolve(result.insertId);
      });
    });
  },

  //add order item
  addOrderItem: (orderId, productId, productName, price, quantity) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO order_items (orderId, productId, productName, price, quantity)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(sql, [orderId, productId, productName, price, quantity], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  //get orders by user
  getOrdersByUser: (userId, callback) => {
    const sql = `
      SELECT * FROM orders
      WHERE userId = ?
      ORDER BY createdAt DESC
    `;
    db.query(sql, [userId], callback);
  },

  //get invoice details
  getInvoiceDetails: (orderId, callback) => {
    const sql = `
      SELECT 
        o.id AS orderId,
        o.address, 
        o.paymentMethod, 
        o.subtotal, 
        o.shipping, 
        o.total, 
        o.createdAt,
        oi.productName,
        oi.price,
        oi.quantity
      FROM orders o
      JOIN order_items oi ON o.id = oi.orderId
      WHERE o.id = ?
    `;
    db.query(sql, [orderId], callback);
  },

  //get all orders with user info (admin)
  getAllOrders: (callback) => {
    const sql = `
      SELECT 
        o.id AS orderId,
        o.userId,
        u.username,
        u.email,
        o.address,
        o.paymentMethod,
        o.subtotal,
        o.shipping,
        o.total,
        o.createdAt
      FROM orders o
      LEFT JOIN users u ON u.id = o.userId
      ORDER BY o.createdAt DESC
    `;
    db.query(sql, [], callback);
  }
};
