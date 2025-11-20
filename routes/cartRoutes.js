const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

// Show cart
router.get("/cart", cartController.showCart);

// Add to cart
router.post("/add-to-cart/:id", cartController.addToCart);

// Delete a single item
router.post("/cart/delete/:id", cartController.removeItem);

// Update quantity (+ / -)
router.post("/cart/update/:id", cartController.updateQuantity);

// Clear cart
router.post("/cart/clear", cartController.clearCart);

module.exports = router;

