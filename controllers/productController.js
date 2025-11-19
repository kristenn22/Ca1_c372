// controllers/productController.js
const Product = require('../models/Products');

module.exports = {

  listProducts: async (req, res) => {
    try {
      const products = await Product.getAll();
      if (req.session.user.role === 'admin') {
        return res.render('inventory', { products, user: req.session.user });
      }
      return res.render('shopping', { products, user: req.session.user });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  },

  getProductById: (req, res) => {
    const id = req.params.id;
    Product.getProductById(id, (err, results) => {
      if (err) return res.status(500).send(err);
      if (!results || results.length === 0)
        return res.status(404).send('Product not found');

      res.render('product', {
        product: results[0],
        user: req.session.user
      });
    });
  },

  renderAddForm: (req, res) => {
    res.render('addProduct', { user: req.session.user });
  },

  addProduct: async (req, res) => {
    try {
      const { name, quantity, price } = req.body;
      const image = req.file ? req.file.filename : null;

      await Product.add({ name, quantity, price, image });
      res.redirect('/products');

    } catch (err) {
      console.error(err);
      res.status(500).send('Error adding product');
    }
  },

  renderUpdateForm: async (req, res) => {
    try {
      const id = req.params.id;
      const product = await Product.getById(id);
      if (!product) return res.status(404).send('Product not found');

      res.render('updateProduct', { product, user: req.session.user });

    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  },

  updateProduct: async (req, res) => {
    try {
      const id = req.params.id;
      const { name, quantity, price } = req.body;

      let image = req.body.currentImage;
      if (req.file) image = req.file.filename;

      await Product.update(id, { name, quantity, price, image });
      res.redirect('/products');

    } catch (err) {
      console.error(err);
      res.status(500).send('Error updating product');
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const id = req.params.id;

      await Product.delete(id);
      res.redirect('/products');

    } catch (err) {
      console.error(err);
      res.status(500).send('Error deleting product');
    }
  }

};
