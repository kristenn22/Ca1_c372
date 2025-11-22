const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

//Cart functions 
router.get("/", cartController.showCart);
router.post("/delete/:id", cartController.removeItem);
router.post("/update/:id", cartController.updateQuantity);
router.post("/clear", cartController.clearCart);
router.post("/add/:id", cartController.addToCart);

//checkout functions 
router.get("/checkout", cartController.checkout);
router.post("/checkout/submit", cartController.submitCheckout);


module.exports = router;

