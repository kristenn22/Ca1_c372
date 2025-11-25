const express = require("express");
const router = express.Router();
const OrderController = require("../controllers/orderController");

router.get("/invoices", OrderController.showInvoices);
router.get("/invoice/:id", OrderController.showInvoiceDetails);

module.exports = router;

