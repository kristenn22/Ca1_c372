const Order = require("../models/order");
const Product = require("../models/Products");  // Ensure you import Product model

module.exports = {
  placeOrder: (req, res) => {
    const userId = req.session.user.id;  // session uses "id"
    const cart = req.session.cart || [];
    const address = req.body.address;
    const paymentMethod = req.body.paymentMethod;

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shipping = 3.99;
    const total = subtotal + shipping;

    // Insert into orders table
    Order.createOrder(userId, address, paymentMethod, subtotal, shipping, total, (err, result) => {
      if (err) throw err;

      const orderId = result.insertId;

      // Flag to track when all items are processed
      let processedItems = 0;

      // Insert each item into order_items and reduce product quantity
      cart.forEach(item => {
        // Insert each item into order_items
        Order.addOrderItem(
          orderId,
          item.id,          // productId
          item.name,        // productName
          item.price,
          item.qty,
          (err) => {
            if (err) {
              console.error(`Failed to add order item ${item.id}:`, err);
            }
            processedItems++;

            // Reduce product quantity in products table after item is added
            Product.reduceQuantity(item.id, item.qty, (err) => {
              if (err) {
                console.error(`Failed to reduce quantity for product ${item.id}:`, err);
              }
              processedItems++;

              // Check if all items have been processed
              if (processedItems === cart.length * 2) {  // Each item is processed twice
                // Clear cart after all items have been processed
                req.session.cart = [];

                // Show success page
                res.render("ordersuccess", { orderId });
              }
            });
          }
        );
      });
    });
  },

  showInvoices: (req, res) => {
    const userId = req.session.user.id;

    Order.getOrdersByUser(userId, (err, orders) => {
      if (err) throw err;
      res.render("invoices", { orders });
    });
  },

  showInvoiceDetails: (req, res) => {
    const orderId = req.params.id;

    Order.getInvoiceDetails(orderId, (err, rows) => {
      if (err) throw err;
      res.render("invoiceDetails", { rows });
    });
  }
};
