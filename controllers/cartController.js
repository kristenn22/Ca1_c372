const Product = require('../models/Products');
const Order = require('../models/order');

module.exports = {

  // ADD TO CART
  addToCart: async (req, res) => {
    const id = req.body.productId;
    const quantity = parseInt(req.body.quantity) || 1;

    const product = await Product.getById(id);
    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect("/shopping");
    }

    if (!req.session.cart) req.session.cart = [];
    let cart = req.session.cart;

    let existing = cart.find(item => item.id == id);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({
        id: product.id,
        name: product.productName,
        price: product.price,
        image: product.image,
        quantity
      });
    }

    req.flash("success", `${product.productName} added to cart`);
    return res.redirect("/cart");
  },

  // SHOW CART
  showCart: (req, res) => {
    const cart = req.session.cart || [];
    res.render("cart", { cart });
  },

  // REMOVE ITEM
  removeItem: (req, res) => {
    const id = req.params.id;
    req.session.cart = (req.session.cart || []).filter(item => item.id != id);
    req.flash("success", "Item removed");
    res.redirect("/cart");
  },

  // UPDATE QUANTITY
  updateQuantity: (req, res) => {
    const id = req.params.id;
    const qty = parseInt(req.body.quantity);
    const cart = req.session.cart || [];

    let item = cart.find(i => i.id == id);
    if (item) item.quantity = qty;

    req.flash("success", "Quantity updated");
    res.redirect("/cart");
  },

  // CLEAR CART
  clearCart: (req, res) => {
    req.session.cart = [];
    req.flash("success", "Cart cleared");
    res.redirect("/cart");
  },

  // CHECKOUT PAGE
  checkout: (req, res) => {
    const cart = req.session.cart || [];

    if (cart.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/shopping');
    }

    const subtotal = cart.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);

    const shipping = 3.99;
    const total = subtotal + shipping;

    res.render("checkout", {
      cart,
      subtotal,
      shipping,
      total
    });
  },

  // SUBMIT CHECKOUT (PLACE ORDER)
  submitCheckout: async (req, res) => {

    const cart = req.session.cart || [];
    if (cart.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/shopping');
    }

    const userId = req.session.user.id;
    const address = req.body.address;
    const paymentMethod = req.body.paymentMethod;

    const subtotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);
    const shipping = 3.99;
    const total = subtotal + shipping;

    // 1) Create ORDER
    const orderId = await Order.createOrder(
      userId,
      address,
      paymentMethod,
      subtotal,
      shipping,
      total
    );

    // 2) Insert order items
    for (const item of cart) {
      await Order.addOrderItem(
        orderId,
        item.id,        
        item.name,      
        item.price,
        item.quantity
      );
    }

    // 3) Clear cart
    req.session.cart = [];

    // 4) Redirect to order success page
    res.redirect(`/order-success/${orderId}`);
  }

};