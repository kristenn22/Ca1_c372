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
      SELECT 
        o.*,
        rc.status AS refundStatus
      FROM orders o
      LEFT JOIN refund_concerns rc ON rc.orderId = o.id
      WHERE o.userId = ?
      ORDER BY o.createdAt DESC
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
        o.status,
        o.isDelivered,
        o.deliveryConfirmedAt,
        o.isPaymentReleased,
        o.paymentReleasedAt,
        o.createdAt,
        oi.id AS orderItemId,
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
        o.status,
        o.isDelivered,
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
  },

  // Update order status (admin)
  updateOrderStatus: (orderId, newStatus) => {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE orders SET status = ? WHERE id = ?`;
      db.query(sql, [newStatus, orderId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  // Confirm delivery by user
  confirmDelivery: (orderId) => {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE orders SET isDelivered = TRUE, deliveryConfirmedAt = NOW(), status = 'Delivered' WHERE id = ?`;
      db.query(sql, [orderId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  // Release payment to seller
  releasePayment: (orderId) => {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE orders SET isPaymentReleased = TRUE, paymentReleasedAt = NOW() WHERE id = ?`;
      db.query(sql, [orderId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  // Get order details by ID
  getOrderById: (orderId) => {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM orders WHERE id = ?`;
      db.query(sql, [orderId], (err, results) => {
        if (err) return reject(err);
        resolve(results && results[0] ? results[0] : null);
      });
    });
  },

  // Add refund concern
  addRefundConcern: (orderId, userId, reason, description, imagePath, refundType, refundItems, refundAmount) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO refund_concerns (orderId, userId, reason, description, imagePath, refundType, refundItems, refundAmount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
      `;
      console.log('Inserting refund concern with:', { orderId, userId, reason, description, imagePath, refundType, refundItems, refundAmount });
      db.query(sql, [orderId, userId, reason, description, imagePath, refundType, refundItems, refundAmount], (err, result) => {
        if (err) {
          console.error('Error inserting refund concern:', err);
          return reject(err);
        }
        console.log('Refund concern inserted with ID:', result.insertId);
        resolve(result.insertId);
      });
    });
  },

  // Calculate refund amount for selected items
  getRefundItemsTotal: (orderId, itemIds) => {
    return new Promise((resolve, reject) => {
      if (!itemIds || !itemIds.length) return resolve(0);
      const placeholders = itemIds.map(() => '?').join(',');
      const sql = `
        SELECT COALESCE(SUM(price * quantity), 0) AS refundAmount
        FROM order_items
        WHERE orderId = ? AND id IN (${placeholders})
      `;
      db.query(sql, [orderId, ...itemIds], (err, results) => {
        if (err) return reject(err);
        const amount = results && results[0] ? Number(results[0].refundAmount || 0) : 0;
        resolve(amount);
      });
    });
  },

  // Get refund concerns for an order
  getRefundConcernsByOrder: (orderId, callback) => {
    const sql = `
      SELECT * FROM refund_concerns
      WHERE orderId = ?
      ORDER BY createdAt DESC
    `;
    db.query(sql, [orderId], callback);
  },

  // Get all refund concerns (admin)
  getAllRefundConcerns: (callback) => {
    const sql = `
      SELECT 
        rc.id,
        rc.orderId,
        rc.userId,
        rc.reason,
        rc.description,
        rc.imagePath,
        rc.refundType,
        rc.refundItems,
        rc.refundAmount,
        rc.status,
        rc.createdAt,
        rc.resolvedAt,
        u.username,
        u.email,
        o.total,
        COUNT(DISTINCT oi.id) AS itemCount,
        GROUP_CONCAT(oi.productName SEPARATOR ', ') AS refundItemNames
      FROM refund_concerns rc
      LEFT JOIN users u ON u.id = rc.userId
      LEFT JOIN orders o ON o.id = rc.orderId
      LEFT JOIN order_items oi ON o.id = oi.orderId
      GROUP BY rc.id
      ORDER BY rc.createdAt DESC
    `;
    db.query(sql, [], (err, concerns) => {
      if (err) return callback(err);
      
      // For each concern, fetch all items for that order
      if (!concerns || concerns.length === 0) return callback(null, concerns);
      
      let processedCount = 0;
      const processedConcerns = [];
      
      concerns.forEach(concern => {
        const itemSql = `
          SELECT 
            oi.id AS orderItemId,
            oi.productName,
            oi.price,
            oi.quantity
          FROM order_items oi
          WHERE oi.orderId = ?
        `;
        db.query(itemSql, [concern.orderId], (err, items) => {
          if (!err) concern.items = items;
          processedCount++;
          if (processedCount === concerns.length) {
            callback(null, concerns);
          }
        });
      });
    });
  },

  // Get recent refunded items for dashboard
  getRecentRefundedItems: (limit = 6) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          rh.id,
          rh.amount,
          rh.createdAt,
          rc.orderId,
          rc.refundType,
          rc.refundItems,
          GROUP_CONCAT(oi.productName SEPARATOR ', ') AS refundItemNames
        FROM refund_history rh
        JOIN refund_concerns rc ON rc.id = rh.concernId
        LEFT JOIN order_items oi ON FIND_IN_SET(oi.id, rc.refundItems)
        GROUP BY rh.id, rh.amount, rh.createdAt, rc.orderId, rc.refundType, rc.refundItems
        ORDER BY rh.createdAt DESC
        LIMIT ?
      `;
      db.query(sql, [limit], (err, results) => {
        if (err) return reject(err);
        resolve(results || []);
      });
    });
  },

  // Approve refund
  approveRefund: (concernId, orderId, amount) => {
    return new Promise((resolve, reject) => {
      // Update concern status
      const updateConcernSQL = `
        UPDATE refund_concerns 
        SET status = 'Approved', resolvedAt = NOW()
        WHERE id = ?
      `;

      db.query(updateConcernSQL, [concernId], (err) => {
        if (err) return reject(err);

        // Create refund history record
        const createHistorySQL = `
          INSERT INTO refund_history (concernId, orderId, userId, amount, refundStatus)
          SELECT id, ?, userId, ?, 'Processed'
          FROM refund_concerns WHERE id = ?
        `;

        db.query(createHistorySQL, [orderId, amount, concernId], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
    });
  },

  // Reject refund
  rejectRefund: (concernId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE refund_concerns 
        SET status = 'Rejected', resolvedAt = NOW()
        WHERE id = ?
      `;
      db.query(sql, [concernId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  // Get refund history for an order
  getRefundHistory: (orderId, callback) => {
    const sql = `
      SELECT * FROM refund_history
      WHERE orderId = ?
      ORDER BY createdAt DESC
    `;
    db.query(sql, [orderId], callback);
  },

  // Check if user can raise concern for an order
  canRaiseConcern: (orderId, userId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id FROM orders
        WHERE id = ? 
          AND userId = ? 
          AND isDelivered = TRUE
          AND UPPER(COALESCE(paymentMethod, '')) != 'NETS QR'
          AND DATEDIFF(NOW(), createdAt) <= 14
      `;
      db.query(sql, [orderId, userId], (err, results) => {
        if (err) return reject(err);
        resolve(results && results.length > 0);
      });
    });
  },

  // Auto-confirm delivery for orders older than 2 weeks with no refund concern
  autoConfirmOldOrders: () => {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE orders o
        SET o.status = 'Delivered', 
            o.isDelivered = TRUE, 
            o.deliveryConfirmedAt = NOW()
        WHERE o.status = 'Out for Delivery'
          AND o.createdAt <= DATE_SUB(NOW(), INTERVAL 2 WEEK)
          AND o.isDelivered = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM refund_concerns rc 
            WHERE rc.orderId = o.id
          )
      `;
      db.query(sql, (err, result) => {
        if (err) return reject(err);
        console.log(`Auto-confirmed ${result.affectedRows} old orders`);
        resolve(result.affectedRows);
      });
    });
  },

  // Check if order is older than 2 weeks
  isOrderOlderThanTwoWeeks: (orderId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          DATEDIFF(NOW(), createdAt) > 14 as isOld
        FROM orders
        WHERE id = ?
      `;
      db.query(sql, [orderId], (err, results) => {
        if (err) return reject(err);
        resolve(results && results[0] && results[0].isOld === 1);
      });
    });
  },

  getRefundConcernByOrderId: (orderId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM refund_concerns
        WHERE orderId = ?
        ORDER BY createdAt DESC
        LIMIT 1
      `;
      db.query(sql, [orderId], (err, results) => {
        if (err) return reject(err);
        resolve(results && results[0] ? results[0] : null);
      });
    });
  }
};
