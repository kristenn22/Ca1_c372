const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const UserController = require('./controllers/userController');
const ProductController = require('./controllers/productController');
const CartController = require('./controllers/cartController');
const OrderController = require('./controllers/orderController');

const app = express();

// views & body parsing
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// multer (for product images)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'images')),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// session + flash
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));
app.use(flash());

// expose session and flash messages to views
app.use((req, res, next) => {
    if (req.session && req.session.user && req.session.user.role) {
        req.session.user.role = req.session.user.role.toString().toLowerCase().trim();
    }
    res.locals.session = req.session;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentPath = (req.path || '').toLowerCase();
    next();
});

// force admins to land on the admin dashboard unless they are already there or logging out
app.use((req, res, next) => {
    const user = req.session && req.session.user;
    if (!user || user.role !== 'admin') return next();

    const path = req.path.toLowerCase();
    const isAdminArea = path.startsWith('/admin');
    const isAdminDashboardAlias = path.startsWith('/admindashboard');
    const isLogout = path.startsWith('/logout');
    const isProductManagement = path.startsWith('/products')
        || path.startsWith('/product')
        || path.startsWith('/addproduct')
        || path.startsWith('/updateproduct');

    if (!isAdminArea && !isAdminDashboardAlias && !isLogout && !isProductManagement) {
        return res.redirect('/adminDashboard');
    }
    return next();
});

// auth middleware
const checkAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) return next();
    req.flash('error', 'Please log in');
    return res.redirect('/login');
};

// Redirect admins to dashboard for user-only pages
const redirectAdminToDashboard = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return res.redirect('/adminDashboard');
    }
    return next();
};

const checkAuthorised = (roles = []) => (req, res, next) => {
    if (!req.session || !req.session.user) {
        req.flash('error', 'Please log in');
        return res.redirect('/login');
    }
    if (roles.length === 0) return next();
    const role = (req.session.user.role || '').toString().toLowerCase().trim();
    const allowed = roles.map(r => r.toLowerCase().trim());
    if (allowed.includes(role)) return next();
    req.flash('error', 'Access denied');
    return res.redirect('/shopping');
};

// Home
app.get('/', (req, res) => {
    const user = req.session.user;
    if (user && user.role === 'admin') {
        return res.redirect('/adminDashboard');
    }
    return res.render('index', { user });
});

// Auth routes
app.get('/login', UserController.renderLogin);
app.post('/login', UserController.login);
app.get('/logout', checkAuthenticated, UserController.logout);
app.get('/register', UserController.renderRegister);
app.post('/register', UserController.register);

// Product routes
app.get('/products', checkAuthenticated, ProductController.listProducts);
app.get('/shopping', checkAuthenticated, redirectAdminToDashboard, ProductController.listProducts);
app.get('/product/:id', checkAuthenticated, ProductController.getProductById);

app.get('/addProduct', checkAuthenticated, checkAuthorised(['admin']), ProductController.renderAddForm);
app.post('/products/add', checkAuthenticated, checkAuthorised(['admin']), upload.single('image'), ProductController.addProduct);

app.get('/updateProduct/:id', checkAuthenticated, checkAuthorised(['admin']), ProductController.renderUpdateForm);
app.post('/products/update/:id', checkAuthenticated, checkAuthorised(['admin']), upload.single('image'), ProductController.updateProduct);

app.get('/products/delete/:id', checkAuthenticated, checkAuthorised(['admin']), ProductController.deleteProduct);

// Cart routes (admins redirected to dashboard)
app.get('/cart', checkAuthenticated, redirectAdminToDashboard, CartController.showCart);
app.post('/cart/add', checkAuthenticated, redirectAdminToDashboard, (req, res) => {
    req.params.productId = req.body.productId || req.query.productId;
    return CartController.addToCart(req, res);
});
app.post('/cart/remove', checkAuthenticated, redirectAdminToDashboard, (req, res) => {
    req.params.id = req.body.cartId || req.query.cartId;
    return CartController.removeItem(req, res);
});
app.post('/cart/clear', checkAuthenticated, redirectAdminToDashboard, (req, res) => CartController.clearCart(req, res));
app.post('/cart/update', checkAuthenticated, redirectAdminToDashboard, (req, res) => {
    req.params.id = req.body.cartId || req.query.cartId;
    req.body.action = req.body.action;
    return CartController.updateQuantity(req, res);
});

// Checkout routes
app.get('/cart/checkout', checkAuthenticated, redirectAdminToDashboard, CartController.checkout);
app.post('/cart/checkout/submit', checkAuthenticated, redirectAdminToDashboard, CartController.submitCheckout);

// POST route for placing the order (should be used to submit the order form)
app.post('/placeOrder', redirectAdminToDashboard, OrderController.placeOrder);  

// Order routes
app.get('/order-success/:orderId', checkAuthenticated, redirectAdminToDashboard, OrderController.showOrderSuccess);
app.get('/invoices', checkAuthenticated, redirectAdminToDashboard, OrderController.showInvoices);
app.get('/invoice/:id', checkAuthenticated, redirectAdminToDashboard, OrderController.showInvoiceDetails);

// Admin Dashboard Routes (with alias)
app.get('/admin/dashboard',
    checkAuthenticated,
    checkAuthorised(['admin']),
    (req, res) => {
        res.render('adminDashboard', { user: req.session.user });
    }
);
app.get('/adminDashboard',
    checkAuthenticated,
    checkAuthorised(['admin']),
    (req, res) => {
        res.render('adminDashboard', { user: req.session.user });
    }
);

// DELETE PRODUCT (admin only)
app.get('/products/delete/:id', checkAuthenticated, checkAuthorised(['admin']), ProductController.deleteProduct);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
