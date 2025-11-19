const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

// Ensure the user is logged in
const ensureAuth = (req, res, next) => {
  if (req.session && req.session.user) return next();
  req.flash("error", "Please login first");
  res.redirect("/login");
};

// add to cart
router.post("/add-to-cart/:id", ensureAuth, cartController.addToCart);

// show cart
router.get("/cart", ensureAuth, cartController.showCart);

// remove from cart
router.get("/cart/remove/:id", ensureAuth, cartController.removeItem);

module.exports = router;
