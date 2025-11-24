const Order = require("../models/order");

module.exports = {
  placeOrder: (req, res) => {
    const userId = req.session.user.id;  //session uses "id"
    const cart = req.session.cart || [];
    const address = req.body.address;
    const paymentMethod = req.body.paymentMethod;

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shipping = 3.99;
    const total = subtotal + shipping;

    //Insert into orders table
    Order.createOrder(userId, address, paymentMethod, subtotal, shipping, total, (err, result) => {
      if (err) throw err;

      const orderId = result.insertId;

      //Insert each item into order_items
      cart.forEach(item => {
        Order.addOrderItem(
          orderId,
          item.id,          // productId
          item.name,        // productName
          item.price,
          item.qty,
          () => {}
        );
      });

      //Clear cart
      req.session.cart = [];

      //Show success page
      res.render("ordersuccess", { orderId });
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

