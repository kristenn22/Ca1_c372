const Product = require('../models/Products');
const Order = require('../models/order');

module.exports = {

  // add to cart
  addToCart: async (req, res) => {
    const id = req.body.productId;
    const quantity = parseInt(req.body.quantity) || 1;

    console.log("Adding productId:", id);

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

  //show cart
  showCart: (req, res) => {
    const cart = req.session.cart || [];
    res.render("cart", { cart });
  },

  // to remove item
  removeItem: (req, res) => {
    const id = req.params.id;
    req.session.cart = (req.session.cart || []).filter(item => item.id != id);
    req.flash("success", "Item removed");
    res.redirect("/cart");
  },

// to update quantity
  updateQuantity: (req, res) => {
    const id = req.params.id;
    const qty = parseInt(req.body.quantity);
    const cart = req.session.cart || [];

    let item = cart.find(i => i.id == id);
    if (item) item.quantity = qty;

    req.flash("success", "Quantity updated");
    res.redirect("/cart");
  },

  // to clear cart
  clearCart: (req, res) => {
    req.session.cart = [];
    req.flash("success", "Cart cleared");
    res.redirect("/cart");
  },

// checkout page
  checkout: (req, res) => {
    const cart = req.session.cart || [];

    if (cart.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/shopping');
    }

    const subtotal = cart.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);

    const shipping = cart.length > 0 ? 3.99 : 0;
    const total = subtotal + shipping;

    res.render("checkout", {
      cart,
      subtotal,
      shipping,
      total
    });
  },

// submit checkout
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

    // 1) Insert ORDER
    const orderId = await Order.createOrder(
      userId,
      address,
      paymentMethod,
      subtotal,
      shipping,
      total
    );

    // 2) Insert ORDER ITEMS
    for (const item of cart) {
      await Order.addOrderItem(orderId, item);
    }

    // 3) Clear Session Cart
    req.session.cart = [];

    // 4) Redirect to Order Success Page
    res.redirect(`/order-success/${orderId}`);
  }

};
