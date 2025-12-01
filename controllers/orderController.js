const Order = require("../models/order");
const Product = require("../models/Products");  // Ensure you import Product model

module.exports = {
  placeOrder: async (req, res) => {
    try {
      const userId = req.session.user.id;
      const cart = req.session.cart || [];
      const address = req.body.address;
      const paymentMethod = req.body.paymentMethod;

      if (!cart.length) {
        req.flash("error", "Your cart is empty");
        return res.redirect("/shopping");
      }

      const subtotal = cart.reduce((sum, item) => {
        const qty = item.quantity ?? item.qty ?? 0;
        return sum + item.price * qty;
      }, 0);

      const shipping = 3.99;
      const total = subtotal + shipping;

      const orderId = await Order.createOrder(userId, address, paymentMethod, subtotal, shipping, total);

      for (const item of cart) {
        const qty = item.quantity ?? item.qty ?? 1;

        await Order.addOrderItem(orderId, item.id, item.name, item.price, qty);

        // Wrap reduceQuantity callback into a promise so we await stock updates as well
        await new Promise((resolve, reject) => {
          Product.reduceQuantity(item.id, qty, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      }

      req.session.cart = [];
      return res.redirect(`/order-success/${orderId}`);
    } catch (error) {
      console.error("Error placing order:", error);
      req.flash("error", "Could not place your order. Please try again.");
      return res.redirect("/cart");
    }
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
  },

  showOrderSuccess: (req, res) => {
    const orderId = req.params.orderId;

    Order.getInvoiceDetails(orderId, (err, rows) => {
      if (err) {
        console.error("Failed to load order invoice:", err);
        req.flash("error", "Could not load order details.");
        return res.redirect("/shopping");
      }

      if (!rows || rows.length === 0) {
        req.flash("error", "Order not found.");
        return res.redirect("/shopping");
      }

      return res.render("orderSuccess", { orderId, rows });
    });
  },

  showAllInvoices: (req, res) => {
    Order.getAllOrders((err, orders) => {
      if (err) {
        console.error("Failed to load orders:", err);
        req.flash("error", "Could not load orders.");
        return res.redirect("/adminDashboard");
      }
      return res.render("adminOrders", { orders, user: req.session.user });
    });
  }
};
