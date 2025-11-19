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

// Simple auth / admin middleware (session-based)
const ensureAuth = (req, res, next) => {
	if (req.session && req.session.user) return next();
	req.flash('error', 'Please log in to continue');
	res.redirect('/login');
};
const ensureAdmin = (req, res, next) => {
	if (req.session && req.session.user && req.session.user.role === 'admin') return next();
	req.flash('error', 'Access denied');
	res.redirect('/shopping');
};

// Routes
router.get('/products', ensureAuth, ProductController.listProducts);
router.get('/shopping', ensureAuth, ProductController.listProducts);
router.get('/products/:id', ensureAuth, ProductController.getProductById);
router.get('/addProduct', ensureAuth, ensureAdmin, ProductController.renderAddForm);
router.post('/products/add', ensureAuth, ensureAdmin, upload.single('image'), ProductController.addProduct);
router.get('/updateProduct/:id', ensureAuth, ensureAdmin, ProductController.renderUpdateForm);
router.post('/products/update/:id', ensureAuth, ensureAdmin, upload.single('image'), ProductController.updateProduct);
router.get('/products/delete/:id', ensureAuth, ensureAdmin, ProductController.deleteProduct);

module.exports = router;

