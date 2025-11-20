const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

router.get("/", cartController.showCart);
router.post("/delete/:id", cartController.removeItem);
router.post("/update/:id", cartController.updateQuantity);
router.post("/clear", cartController.clearCart);
router.post("/add/:id", cartController.addToCart);

module.exports = router;

