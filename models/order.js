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
  },

  //get count of all orders
  getOrderCount: () => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM orders';
      db.query(sql, (err, results) => {
        if (err) {
          console.error('Error getting order count:', err);
          return reject(err);
        }
        const count = results && results[0] ? results[0].count : 0;
        resolve(count);
      });
    });
  },

  //get count of orders for current month only
  getMonthlyOrderCount: () => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM orders WHERE MONTH(createdAt) = MONTH(NOW()) AND YEAR(createdAt) = YEAR(NOW())';
      db.query(sql, (err, results) => {
        if (err) {
          console.error('Error getting monthly order count:', err);
          return reject(err);
        }
        const count = results && results[0] ? results[0].count : 0;
        resolve(count);
      });
    });
  },

  //get count of pending orders
  getPendingOrderCount: () => {
    return new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(*) as count FROM orders WHERE createdAt > DATE_SUB(NOW(), INTERVAL 30 DAY) AND paymentMethod NOT IN ('Pending', 'Failed')`;
      db.query(sql, (err, results) => {
        if (err) {
          console.error('Error getting pending order count:', err);
          return reject(err);
        }
        const count = results && results[0] ? results[0].count : 0;
        resolve(count);
      });
    });
  },

  //get total earnings for current month
  getMonthlyEarnings: () => {
    return new Promise((resolve, reject) => {
      const sql = `SELECT COALESCE(SUM(total), 0) as earnings FROM orders WHERE MONTH(createdAt) = MONTH(NOW()) AND YEAR(createdAt) = YEAR(NOW())`;
      db.query(sql, (err, results) => {
        if (err) {
          console.error('Error fetching monthly earnings:', err);
          return reject(err);
        }
        const earnings = results && results[0] ? results[0].earnings : 0;
        resolve(earnings);
      });
    });
  },

  //get transactions by date range
  getTransactionsByDateRange: (filterType) => {
    return new Promise((resolve, reject) => {
      let dateCondition = '';
      
      switch(filterType) {
        case 'today':
          dateCondition = `DATE(o.createdAt) = CURDATE()`;
          break;
        case 'week':
          dateCondition = `o.createdAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
          break;
        case 'month':
          dateCondition = `MONTH(o.createdAt) = MONTH(NOW()) AND YEAR(o.createdAt) = YEAR(NOW())`;
          break;
        case 'year':
          dateCondition = `YEAR(o.createdAt) = YEAR(NOW())`;
          break;
        case 'lastYear':
          dateCondition = `YEAR(o.createdAt) = YEAR(NOW()) - 1`;
          break;
        default:
          dateCondition = `1=1`;
      }

      const sql = `
        SELECT 
          o.id AS orderId,
          o.userId,
          u.username,
          u.email,
          o.paymentMethod,
          o.subtotal,
          o.shipping,
          o.total,
          o.createdAt,
          DATE_FORMAT(o.createdAt, '%Y-%m-%d %H:%i') as formattedDate
        FROM orders o
        LEFT JOIN users u ON u.id = o.userId
        WHERE ${dateCondition}
        ORDER BY o.createdAt DESC
      `;
      
      db.query(sql, (err, results) => {
        if (err) {
          console.error('Error fetching transactions:', err);
          return reject(err);
        }
        resolve(results || []);
      });
    });
  },

  //get transactions by custom date range
  getTransactionsByCustomRange: (startDate, endDate) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          o.id AS orderId,
          o.userId,
          u.username,
          u.email,
          o.paymentMethod,
          o.subtotal,
          o.shipping,
          o.total,
          o.createdAt,
          DATE_FORMAT(o.createdAt, '%Y-%m-%d %H:%i') as formattedDate
        FROM orders o
        LEFT JOIN users u ON u.id = o.userId
        WHERE DATE(o.createdAt) BETWEEN ? AND ?
        ORDER BY o.createdAt DESC
      `;
      
      db.query(sql, [startDate, endDate], (err, results) => {
        if (err) {
          console.error('Error fetching transactions by custom range:', err);
          return reject(err);
        }
        resolve(results || []);
      });
    });
  }
};
