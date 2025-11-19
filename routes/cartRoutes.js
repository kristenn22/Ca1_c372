const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cartController');

// Simple authentication middleware (uses session)
const ensureAuth = (req, res, next) => {
  if (req.session && req.session.user) return next();
  req.flash('error', 'Please log in to continue');
  res.redirect('/login');
};

router.get('/cart', ensureAuth, CartController.viewCart);
router.post('/cart/add/:productId', ensureAuth, CartController.addToCart);
router.post('/cart/update/:cartId', ensureAuth, CartController.updateItem);
router.get('/cart/remove/:cartId', ensureAuth, CartController.removeItem);
router.post('/cart/checkout', ensureAuth, CartController.checkout);

module.exports = router;
