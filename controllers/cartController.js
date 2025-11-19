const Product = require('../models/Products');

module.exports = {
  addToCart: async (req, res) => {
    try {
      const productId = parseInt(req.params.productId || req.params.id);
      const quantity = parseInt(req.body.quantity) || 1;
      const product = await Product.getById(productId);
      if (!product) return res.status(404).send('Product not found');

      if (!req.session.cart) req.session.cart = [];

      const existingItem = req.session.cart.find(item => item.id === product.id);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        req.session.cart.push({
          id: product.id,
          productName: product.productName,
          price: product.price,
          quantity,
          image: product.image
        });
      }

      res.redirect('/cart');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  },

  updateItem: (req, res) => {
    try {
      const cartId = parseInt(req.params.cartId);
      const quantity = parseInt(req.body.quantity);
      if (!req.session.cart) req.session.cart = [];
      const item = req.session.cart.find(i => i.id === cartId);
      if (!item) return res.status(404).send('Cart item not found');
      if (isNaN(quantity) || quantity < 1) {
        // remove if quantity invalid or zero
        req.session.cart = req.session.cart.filter(i => i.id !== cartId);
      } else {
        item.quantity = quantity;
      }
      res.redirect('/cart');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  },

  removeItem: (req, res) => {
    try {
      const cartId = parseInt(req.params.cartId);
      if (!req.session.cart) req.session.cart = [];
      req.session.cart = req.session.cart.filter(i => i.id !== cartId);
      res.redirect('/cart');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  },

  checkout: (req, res) => {
    try {
      req.session.cart = [];
      req.flash('success', 'Checkout complete. Thank you!');
      res.redirect('/shopping');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  },

  viewCart: (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
  }
};
