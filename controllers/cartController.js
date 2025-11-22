const Product = require('../models/Products');

module.exports = {

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

  showCart: (req, res) => {
    const cart = req.session.cart || [];
    res.render("cart", { cart });
  },

  removeItem: (req, res) => {
    const id = req.params.id;
    req.session.cart = (req.session.cart || []).filter(item => item.id != id);
    req.flash("success", "Item removed");
    res.redirect("/cart");
  },

  updateQuantity: (req, res) => {
    const id = req.params.id;
    const qty = parseInt(req.body.quantity);
    const cart = req.session.cart || [];
    
    let item = cart.find(i => i.id == id);
    if (item) item.quantity = qty;

    req.flash("success", "Quantity updated");
    res.redirect("/cart");
  },

  clearCart: (req, res) => {
    req.session.cart = [];
    req.flash("success", "Cart cleared");
    res.redirect("/cart");
  },

checkout: (req, res) => {
  const cart = req.session.cart || [];

  if (cart.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/shopping');
  }

  // Calculate subtotal
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
};
