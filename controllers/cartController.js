const Product = require("../models/Products");

module.exports = {

  addToCart: async (req, res) => {
    try {
      const productId = req.params.id;
      const quantity = parseInt(req.body.quantity) || 1;

      const product = await Product.getById(productId);
      if (!product) return res.status(404).send("Product not found");

      if (!req.session.cart) req.session.cart = [];

      let existing = req.session.cart.find(item => item.id == productId);

      if (existing) {
        existing.quantity += quantity;
      } else {
        req.session.cart.push({
          id: product.id,
          productName: product.productName,
          price: product.price,
          quantity: quantity,
          image: product.image
        });
      }

      return res.redirect("/cart");

    } catch (err) {
      console.error(err);
      res.status(500).send("Error adding to cart");
    }
  },

  showCart: (req, res) => {
    res.render("cart", {
      user: req.session.user,
      cart: req.session.cart || []
    });
  },

  removeItem: (req, res) => {
    const id = req.params.id;
    req.session.cart = req.session.cart.filter(item => item.id != id);
    res.redirect("/cart");
  },

  updateQuantity: (req, res) => {
    const id = req.params.id;
    const action = req.body.action;

    if (!req.session.cart) req.session.cart = [];

    let item = req.session.cart.find(i => i.id == id);

    if (item) {
      if (action === "increase") {
        item.quantity++;
      } 
      else if (action === "decrease" && item.quantity > 1) {
        item.quantity--;
      }
    }

    res.redirect("/cart");
  },

  clearCart:(req, res) => {
    req.session.cart = [];
    res.redirect("/cart");
  }

};

