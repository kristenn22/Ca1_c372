const Order = require("../models/order");
const Product = require("../models/Products");  // Ensure you import Product model
const Cart = require("../models/Cart");
const db = require("../db");

module.exports = {
  placeOrder: async (req, res) => {
    try {
      const userId = req.session.user.id || req.session.user.userId || req.session.user.ID;
      const cart = (req.session.cart && req.session.cart.length)
        ? req.session.cart
        : await Cart.getCart(userId);
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
      await Cart.clearCart(userId);
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
      if (err) {
        console.error("Failed to load invoices:", err);
        req.flash("error", "Could not load your invoices.");
        return res.redirect("/shopping");
      }
      res.render("invoices", { orders });
    });
  },

  // keep compatibility with older /orderHistory link
  showOrderHistory: (req, res) => {
    return module.exports.showInvoices(req, res);
  },

  showInvoiceDetails: async (req, res) => {
    const orderId = req.params.id;

    try {
      // Auto-confirm old orders before showing details
      await Order.autoConfirmOldOrders();

      // Check if user is admin
      if (req.session.user && req.session.user.role === 'admin') {
        // Show admin invoice detail view
        Order.getInvoiceDetails(orderId, (err, rows) => {
          if (err) throw err;
          res.render("adminInvoiceDetails", { rows });
        });
      } else {
        // Show user invoice detail view
        Order.getInvoiceDetails(orderId, async (err, rows) => {
          if (err) throw err;
          
          // Check if this specific order is old
          const isOld = await Order.isOrderOlderThanTwoWeeks(orderId);
          
          // Check if there's a pending refund concern for this order
          const refundConcern = await Order.getRefundConcernByOrderId(orderId);
          const hasPendingConcern = refundConcern && refundConcern.status === 'Pending';
          
          res.render("invoiceDetails", { rows, isOld, hasPendingConcern });
        });
      }
    } catch (error) {
      console.error("Error showing invoice details:", error);
      req.flash("error", "Could not load invoice details.");
      res.redirect("/invoices");
    }
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
  },

  // Update order status (admin)
  updateOrderStatus: async (req, res) => {
    try {
      const orderId = req.params.id;
      const newStatus = req.body.status;

      // Validate status
      const validStatuses = ['Pending', 'Packed', 'Out for Delivery', 'Delivered', 'Refunded'];
      if (!validStatuses.includes(newStatus)) {
        req.flash('error', 'Invalid status');
        return res.redirect(`/admin/invoice/${orderId}`);
      }

      await Order.updateOrderStatus(orderId, newStatus);
      req.flash('success', `Order status updated to ${newStatus}`);
      res.redirect(`/admin/invoice/${orderId}`);
    } catch (error) {
      console.error("Error updating order status:", error);
      req.flash("error", "Could not update order status.");
      res.redirect(`/admin/invoice/${req.params.id}`);
    }
  },

  // Confirm delivery (user)
  confirmDelivery: async (req, res) => {
    try {
      const orderId = req.params.id;
      const userId = req.session.user.id;

      // Verify order belongs to user
      const order = await Order.getOrderById(orderId);
      if (!order || order.userId !== userId) {
        req.flash('error', 'Unauthorized');
        return res.redirect('/invoices');
      }

      await Order.confirmDelivery(orderId);
      req.flash('success', 'Delivery confirmed! You can now raise a refund concern if needed or payment will be released to seller.');
      res.redirect(`/invoice/${orderId}`);
    } catch (error) {
      console.error("Error confirming delivery:", error);
      req.flash("error", "Could not confirm delivery.");
      res.redirect(`/invoice/${req.params.id}`);
    }
  },

  // Release payment to seller (user or auto)
  releasePayment: async (req, res) => {
    try {
      const orderId = req.params.id;
      const userId = req.session.user.id;

      // Verify order belongs to user
      const order = await Order.getOrderById(orderId);
      if (!order || order.userId !== userId) {
        req.flash('error', 'Unauthorized');
        return res.redirect('/invoices');
      }

      if (!order.isDelivered) {
        req.flash('error', 'Order must be delivered first');
        return res.redirect(`/invoice/${orderId}`);
      }

      await Order.releasePayment(orderId);
      req.flash('success', 'Payment released to seller');
      res.redirect(`/invoice/${orderId}`);
    } catch (error) {
      console.error("Error releasing payment:", error);
      req.flash("error", "Could not release payment.");
      res.redirect(`/invoice/${req.params.id}`);
    }
  },

  // Raise refund concern (user)
  raiseRefundConcern: async (req, res) => {
    try {
      const orderId = req.params.id;
      const userId = req.session.user.id;
      const { reason, description } = req.body;

      console.log('Raising concern for order:', orderId, 'user:', userId);

      // Validate that image is uploaded
      if (!req.file) {
        req.flash('error', 'Please upload an image as evidence');
        return res.redirect(`/invoice/${orderId}`);
      }

      // Verify order belongs to user and is delivered
      const canRaise = await Order.canRaiseConcern(orderId, userId);
      console.log('canRaiseConcern:', canRaise);
      if (!canRaise) {
        req.flash('error', 'You can only raise concerns for delivered orders within 2 weeks of order placement');
        return res.redirect(`/invoice/${orderId}`);
      }

      if (!reason || !description || description.trim().length < 10) {
        req.flash('error', 'Please provide valid reason and description (at least 10 characters)');
        return res.redirect(`/invoice/${orderId}`);
      }

      // Default to Full refund - admin will decide if partial is appropriate
      const refundType = 'Full';
      const refundItemsCsv = null;
      const order = await Order.getOrderById(orderId);
      const refundAmount = order ? Number(order.total || 0) : 0;

      const imagePath = `/images/refunds/${req.file.filename}`;
      console.log('Creating concern with image:', imagePath);
      const concernId = await Order.addRefundConcern(
        orderId,
        userId,
        reason,
        description,
        imagePath,
        refundType,
        refundItemsCsv,
        refundAmount
      );
      console.log('Concern created with ID:', concernId);
      req.flash('success', 'Refund concern raised successfully with image evidence. Admin will review it soon.');
      res.redirect(`/invoice/${orderId}`);
    } catch (error) {
      console.error("Error raising refund concern:", error);
      req.flash("error", `Could not raise refund concern: ${error.message}`);
      res.redirect(`/invoice/${req.params.id}`);
    }
  },

  // View all refund concerns (admin)
  viewRefundConcerns: (req, res) => {
    Order.getAllRefundConcerns((err, concerns) => {
      if (err) {
        console.error("Failed to load refund concerns:", err);
        req.flash("error", "Could not load refund concerns.");
        return res.redirect("/adminDashboard");
      }
      console.log('Retrieved concerns:', concerns);
      return res.render("adminRefundConcerns", { concerns, user: req.session.user });
    });
  },

  // Approve refund (admin)
  approveRefund: async (req, res) => {
    try {
      const concernId = req.params.id;
      const { orderId, amount, refundType } = req.body;
      let { refundItems } = req.body;

      if (!orderId || !amount || parseFloat(amount) <= 0) {
        req.flash('error', 'Invalid order or amount');
        return res.redirect('/admin/refund-concerns');
      }

      // Handle partial refund with item selection
      let refundItemsCsv = null;
      if (refundType === 'Partial') {
        if (!refundItems) {
          req.flash('error', 'Please select items for partial refund');
          return res.redirect('/admin/refund-concerns');
        }

        if (!Array.isArray(refundItems)) {
          refundItems = [refundItems];
        }

        refundItemsCsv = refundItems.join(',');
      }

      // Update refund concern with final approval details
      const updateSql = `
        UPDATE refund_concerns 
        SET 
          status = 'Approved', 
          refundType = ?, 
          refundItems = ?, 
          refundAmount = ?,
          resolvedAt = NOW()
        WHERE id = ?
      `;
      
      await new Promise((resolve, reject) => {
        db.query(updateSql, [refundType, refundItemsCsv, parseFloat(amount), concernId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create refund history record
      const historySql = `
        INSERT INTO refund_history (concernId, orderId, userId, amount, refundStatus)
        SELECT id, orderId, userId, ?, 'Approved'
        FROM refund_concerns
        WHERE id = ?
      `;
      
      await new Promise((resolve, reject) => {
        db.query(historySql, [parseFloat(amount), concernId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      req.flash('success', `Refund of $${amount} approved as ${refundType} refund`);
      res.redirect('/admin/refund-concerns');
    } catch (error) {
      console.error("Error approving refund:", error);
      req.flash("error", "Could not approve refund.");
      res.redirect('/admin/refund-concerns');
    }
  },

  // Reject refund (admin)
  rejectRefund: async (req, res) => {
    try {
      const concernId = req.params.id;

      await Order.rejectRefund(concernId);
      req.flash('success', 'Refund concern rejected');
      res.redirect('/admin/refund-concerns');
    } catch (error) {
      console.error("Error rejecting refund:", error);
      req.flash("error", "Could not reject refund.");
      res.redirect('/admin/refund-concerns');
    }
  }
};
