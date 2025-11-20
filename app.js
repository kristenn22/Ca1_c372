const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const UserController = require('./controllers/userController');
const ProductController = require('./controllers/productController');
const CartController = require('./controllers/cartController');

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
    res.locals.session = req.session;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// auth middleware
const checkAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) return next();
    req.flash('error', 'Please log in');
    return res.redirect('/login');
};

const checkAuthorised = (roles = []) => (req, res, next) => {
    if (!req.session || !req.session.user) {
        req.flash('error', 'Please log in');
        return res.redirect('/login');
    }
    if (roles.length === 0) return next();
    const role = req.session.user.role;
    if (roles.includes(role)) return next();
    req.flash('error', 'Access denied');
    return res.redirect('/shopping');
};

// Home
app.get('/', (req, res) => res.render('index', { user: req.session.user }));

// Auth routes
app.get('/login', UserController.renderLogin);
app.post('/login', UserController.login);
app.get('/logout', checkAuthenticated, UserController.logout);

app.get('/register', UserController.renderRegister);
app.post('/register', UserController.register);

// Product routes
app.get('/products', checkAuthenticated, ProductController.listProducts);
app.get('/shopping', checkAuthenticated, ProductController.listProducts);
app.get('/product/:id', checkAuthenticated, ProductController.getProductById);

app.get('/addProduct', checkAuthenticated, checkAuthorised(['admin']), ProductController.renderAddForm);
app.post('/products/add', checkAuthenticated, checkAuthorised(['admin']), upload.single('image'), ProductController.addProduct);

app.get('/updateProduct/:id', checkAuthenticated, checkAuthorised(['admin']), ProductController.renderUpdateForm);
app.post('/products/update/:id', checkAuthenticated, checkAuthorised(['admin']), upload.single('image'), ProductController.updateProduct);

app.get('/products/delete/:id', checkAuthenticated, checkAuthorised(['admin']), ProductController.deleteProduct);

// Cart routes (using body params for add/remove/clear)
app.get('/cart', checkAuthenticated, CartController.showCart);
app.post('/cart/add', checkAuthenticated, (req, res) => {
    // expect productId in body
    req.params.productId = req.body.productId || req.query.productId;
    return CartController.addToCart(req, res);
});
app.post('/cart/remove', checkAuthenticated, (req, res) => {
    req.params.id = req.body.cartId || req.query.cartId;
    return CartController.removeItem(req, res);
});
app.post('/cart/clear', checkAuthenticated, (req, res) => CartController.clearCart(req, res));
app.post('/cart/update', checkAuthenticated, (req, res) => {
    req.params.id = req.body.cartId || req.query.cartId;
    req.body.action = req.body.action;
    return CartController.updateQuantity(req, res);
});

// Admin Dashboard Route
app.get('/admin/dashboard',
    checkAuthenticated,
    checkAuthorised(['admin']),
    (req, res) => {
        res.render('adminDashboard', { user: req.session.user });
    }
);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
