const Product = require("../models/Products");

module.exports = {

  addToCart: async (req, res) => {
    try {
      const productId = req.params.id;
      const quantity = parseInt(req.body.quantity) || 1;

      // Fetch the product
      const product = await Product.getById(productId);

      if (!product) return res.status(404).send("Product not found");

      // Initialize cart if empty
      if (!req.session.cart) {
        req.session.cart = [];
      }

      // If item exists, update qty
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
  }

};
