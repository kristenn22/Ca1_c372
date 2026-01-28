const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const axios = require('axios');
const UserController = require('./controllers/userController');
const ProductController = require('./controllers/productController');
const CartController = require('./controllers/cartController');
const OrderController = require('./controllers/orderController');
const netsQr = require('./services/nets');
const paypal = require('./services/paypal');

const app = express();

// Load environment variables
require('dotenv').config();

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
app.get('/orderHistory', checkAuthenticated, redirectAdminToDashboard, OrderController.showInvoices); // legacy path
app.get('/invoice/:id', checkAuthenticated, redirectAdminToDashboard, OrderController.showInvoiceDetails);

// Admin Dashboard Routes (with alias)
const Product = require('./models/Products');
const User = require('./models/User');
const Order = require('./models/order');

app.get('/admin/dashboard',
    checkAuthenticated,
    checkAuthorised(['admin']),
    async (req, res) => {
        try {
            console.log('Loading admin dashboard...');
            const productCount = await Product.getCount();
            console.log('Product count:', productCount);
            const userCount = await User.getCount();
            console.log('User count:', userCount);
            const monthlyOrderCount = await Order.getMonthlyOrderCount();
            console.log('Monthly order count:', monthlyOrderCount);
            const monthlyEarnings = await Order.getMonthlyEarnings();
            console.log('Monthly earnings:', monthlyEarnings);

            res.render('adminDashboard', { 
                user: req.session.user,
                productCount: productCount || 0,
                userCount: userCount || 0,
                orderCount: monthlyOrderCount || 0,
                monthlyEarnings: (parseFloat(monthlyEarnings) || 0).toFixed(2)
            });
        } catch (err) {
            console.error('Error loading dashboard:', err);
            res.render('adminDashboard', { 
                user: req.session.user,
                productCount: 0,
                userCount: 0,
                orderCount: 0,
                monthlyEarnings: '0.00'
            });
        }
    }
);
app.get('/adminDashboard',
    checkAuthenticated,
    checkAuthorised(['admin']),
    async (req, res) => {
        try {
            console.log('Loading admin dashboard...');
            const productCount = await Product.getCount();
            console.log('Product count:', productCount);
            const userCount = await User.getCount();
            console.log('User count:', userCount);
            const monthlyOrderCount = await Order.getMonthlyOrderCount();
            console.log('Monthly order count:', monthlyOrderCount);
            const monthlyEarnings = await Order.getMonthlyEarnings();
            console.log('Monthly earnings:', monthlyEarnings);

            res.render('adminDashboard', { 
                user: req.session.user,
                productCount: productCount || 0,
                userCount: userCount || 0,
                orderCount: monthlyOrderCount || 0,
                monthlyEarnings: (parseFloat(monthlyEarnings) || 0).toFixed(2)
            });
        } catch (err) {
            console.error('Error loading dashboard:', err);
            res.render('adminDashboard', { 
                user: req.session.user,
                productCount: 0,
                userCount: 0,
                orderCount: 0,
                monthlyEarnings: '0.00'
            });
        }
    }
);

// Admin management routes
app.get('/admin/orders',
    checkAuthenticated,
    checkAuthorised(['admin']),
    OrderController.showAllInvoices
);
app.get('/admin/invoice/:id',
    checkAuthenticated,
    checkAuthorised(['admin']),
    OrderController.showInvoiceDetails
);
app.get('/admin/users',
    checkAuthenticated,
    checkAuthorised(['admin']),
    UserController.listUsers
);

// Admin Transactions Route
app.get('/admin/transactions',
    checkAuthenticated,
    checkAuthorised(['admin']),
    async (req, res) => {
        try {
            const filterType = req.query.filter || 'month';
            const transactions = await Order.getTransactionsByDateRange(filterType);
            
            res.render('adminTransactions', {
                user: req.session.user,
                transactions: transactions,
                currentFilter: filterType,
                totalTransactions: transactions.length,
                totalEarnings: transactions.reduce((sum, t) => sum + parseFloat(t.total), 0).toFixed(2)
            });
        } catch (err) {
            console.error('Error loading transactions:', err);
            res.render('adminTransactions', {
                user: req.session.user,
                transactions: [],
                currentFilter: 'month',
                totalTransactions: 0,
                totalEarnings: '0.00',
                error: 'Failed to load transactions'
            });
        }
    }
);

// DELETE PRODUCT (admin only)
app.get('/products/delete/:id', checkAuthenticated, checkAuthorised(['admin']), ProductController.deleteProduct);

// NETS QR Payment Routes
app.post('/generateNETSQR', netsQr.generateQrCode);
app.get("/nets-qr/success", (req, res) => {
    res.render('netsTxnSuccessStatus', { message: 'Transaction Successful!' });
});
app.get("/nets-qr/fail", (req, res) => {
    res.render('netsTxnFailStatus', { message: 'Transaction Failed. Please try again.' });
});

// PayPal Payment Routes
app.post('/api/paypal/create-order', checkAuthenticated, redirectAdminToDashboard, async (req, res) => {
  try {
    if (!req.session.user) {
      console.warn('createOrder: user not logged in');
      return res.status(401).json({ error: "User not logged in", message: "Please log in to continue" });
    }

    const userId = req.session.user.id || req.session.user.userId || req.session.user.ID;
    
    if (!userId) {
      console.warn('createOrder: userId not found in session');
      return res.status(401).json({ error: "User ID not found in session", message: "Session error" });
    }

    const { amount } = req.body;

    console.log('createOrder: Creating PayPal order for amount:', amount);

    if (!amount || amount <= 0) {
      console.error('createOrder: refusing to create PayPal order because amount is not positive', { amount });
      return res.status(400).json({ error: 'Cart total must be greater than zero', message: 'Invalid cart total' });
    }

    // Create PayPal order
    const order = await paypal.createOrder(amount);

    if (!order || !order.id) {
      console.error('createOrder: PayPal createOrder returned unexpected payload:', order);
      return res.status(502).json({ error: 'Failed to create PayPal order', details: order });
    }

    console.log('createOrder: PayPal order created:', order.id);

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(500).json({ error: "Failed to create order", message: err.message, details: err.toString() });
  }
});

app.post('/api/paypal/pay', checkAuthenticated, redirectAdminToDashboard, async (req, res) => {
  console.log("=== PAY ENDPOINT CALLED ===");
  console.log("pay called with body:", req.body);
  
  try {
    // Validate user is logged in
    if (!req.session.user) {
      console.warn('pay: user not logged in');
      return res.status(401).json({ error: "User not logged in" });
    }

    const userId = req.session.user.id || req.session.user.userId || req.session.user.ID;
    if (!userId) {
      console.warn('pay: userId not found in session');
      return res.status(401).json({ error: "User ID not found in session" });
    }
    
    // Get the PayPal order ID from request
    const { orderId } = req.body;
    
    if (!orderId) {
      console.warn('pay: orderId not provided in request body');
      return res.status(400).json({ error: "Order ID is required" });
    }

    console.log('pay: Capturing PayPal order:', orderId, 'for userId:', userId);

    // Capture the PayPal payment
    const capture = await paypal.captureOrder(orderId);
    
    console.log('pay: PayPal capture response status:', capture.status);

    if (!capture || capture.status !== 'COMPLETED') {
      console.error('pay: Payment not completed, status:', capture?.status);
      return res.status(400).json({ error: "Payment was not completed", status: capture?.status });
    }

    // Get cart and create order
    const Cart = require('./models/Cart');
    const Order = require('./models/order');
    const Product = require('./models/Products');

    const cart = req.session.cart && req.session.cart.length > 0 
      ? req.session.cart 
      : await Cart.getCart(userId);

    if (!cart || !cart.length) {
      console.warn('pay: No items in cart for userId:', userId);
      return res.status(400).json({ error: "No items in cart to process" });
    }

    console.log('pay: Found', cart.length, 'cart items for userId:', userId);

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => {
      const qty = item.quantity ?? item.qty ?? 0;
      return sum + item.price * qty;
    }, 0);

    const shipping = 3.99;
    const total = subtotal + shipping;

    console.log('pay: Total amount calculated:', total);

    const address = (req.body.address || '').trim();
    console.log('pay: Provided address from request:', address);

    // Create order in database
    const dbOrderId = await Order.createOrder(userId, address, 'PayPal', subtotal, shipping, total);
    console.log('pay: Order created in database with ID:', dbOrderId);

    // Add order items
    for (const item of cart) {
      const qty = item.quantity ?? item.qty ?? 1;
      await Order.addOrderItem(dbOrderId, item.id, item.name, item.price, qty);

      // Update product quantity
      await new Promise((resolve, reject) => {
        Product.reduceQuantity(item.id, qty, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    console.log('pay: Order items added and stock decremented');

    // Clear cart
    req.session.cart = [];
    await Cart.clearCart(userId);

    console.log('pay: Cart cleared successfully');

    res.json({ success: true, orderId: dbOrderId });
  } catch (err) {
    console.error("pay error:", err);
    res.status(500).json({ error: "Failed to process payment", message: err.message, details: err.toString() });
  }
});

// Endpoint for real-time payment status updates via Server-Sent Events (SSE)
app.get('/sse/payment-status/:txnRetrievalRef', async (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const txnRetrievalRef = req.params.txnRetrievalRef;
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes if polling every 5s
    let frontendTimeoutStatus = 0;

    const interval = setInterval(async () => {
        pollCount++;

        try {
            // Call the NETS query API
            const response = await axios.post(
                'https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/query',
                { txn_retrieval_ref: txnRetrievalRef, frontend_timeout_status: frontendTimeoutStatus },
                {
                    headers: {
                        'api-key': process.env.API_KEY,
                        'project-id': process.env.PROJECT_ID,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log("Polling response:", response.data);
            // Send the full response to the frontend
            res.write(`data: ${JSON.stringify(response.data)}\n\n`);
        
            const resData = response.data.result.data;

            // Decide when to end polling and close the connection
            //Check if payment is successful
            if (resData.response_code == "00" && resData.txn_status === 1) {
                // Payment success: send a success message
                res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
                clearInterval(interval);
                res.end();
            } else if (frontendTimeoutStatus == 1 && resData && (resData.response_code !== "00" || resData.txn_status === 2)) {
                // Payment failure: send a fail message
                res.write(`data: ${JSON.stringify({ fail: true, ...resData })}\n\n`);
                clearInterval(interval);
                res.end();
            }

        } catch (err) {
            clearInterval(interval);
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }


        // Timeout
        if (pollCount >= maxPolls) {
            clearInterval(interval);
            frontendTimeoutStatus = 1;
            res.write(`data: ${JSON.stringify({ fail: true, error: "Timeout" })}\n\n`);
            res.end();
        }
    }, 5000);

    req.on('close', () => {
        clearInterval(interval);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
