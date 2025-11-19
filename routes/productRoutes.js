const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const ProductController = require('../controllers/productController');

// Multer storage configuration
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'images')),
	filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Routes
router.get('/products', ProductController.listProducts);
router.get('/products/:id', ProductController.getProductById);
router.post('/products/add', upload.single('image'), ProductController.addProduct);
router.post('/products/update/:id', upload.single('image'), ProductController.updateProduct);
router.get('/products/delete/:id', ProductController.deleteProduct);

module.exports = router;

