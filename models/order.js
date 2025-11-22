const db = require('../db');

module.exports = {

  // Create the order
  createOrder: async (userId, address, paymentMethod, subtotal, shipping, total) => {
    const [result] = await db.execute(
      `INSERT INTO orders (userId, address, paymentMethod, subtotal, shipping, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, address, paymentMethod, subtotal, shipping, total]
    );

    return result.insertId;  // return new order ID
  },

  // Insert each item in the cart
  addOrderItem: async (orderId, item) => {
    await db.execute(
      `INSERT INTO order_items (orderId, productId, productName, price, quantity)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, item.id, item.name, item.price, item.quantity]
    );
  },

  // Get all orders for a user
  getOrdersByUser: async (userId) => {
    const [rows] = await db.execute(
      `SELECT * FROM orders WHERE userId = ? ORDER BY id DESC`,
      [userId]
    );
    return rows;
  },

  // Get items inside an order
  getOrderItems: async (orderId) => {
    const [rows] = await db.execute(
      `SELECT * FROM order_items WHERE orderId = ?`,
      [orderId]
    );
    return rows;
  }
};
