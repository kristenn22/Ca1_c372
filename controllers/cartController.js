const Product = require('../models/Products');
const Order = require('../models/order');

module.exports = {
// ADD TO CART
addToCart: async (req, res) => {
  const id = req.body.productId;
  const quantity = parseInt(req.body.quantity) || 1;

  // Fetch product details
  const product = await Product.getById(id);
  if (!product) {
    req.flash("error", "Product not found");
    return res.redirect("/shopping");
  }

  // Check if requested quantity is available
  if (quantity > product.quantity) {
    req.flash("error", `Sorry, we only have ${product.quantity} of ${product.productName} in stock.`);
    return res.redirect("/shopping");
  }

  // Initialize cart if it doesn't exist
  if (!req.session.cart) req.session.cart = [];
  let cart = req.session.cart;

  // Check if item already exists in cart
  let existing = cart.find(item => item.id == id);

  // If item exists, update quantity, else add it to cart
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.productName,
      price: product.price,
      image: product.image,
      quantity
    });
  }

  req.flash("success", `${product.productName} added to cart`);
  return res.redirect("/shopping");
},

  //show cart
  showCart: (req, res) => {
    const cart = req.session.cart || [];
    res.render("cart", { cart });
  },

  //remove item from cart
  removeItem: (req, res) => {
    const id = req.params.id;
    req.session.cart = (req.session.cart || []).filter(item => item.id != id);
    req.flash("success", "Item removed");
    res.redirect("/cart");
  },

  //update quantity
updateQuantity: async (req, res) => {
  const id = req.params.id;
  const qty = parseInt(req.body.quantity);
  const cart = req.session.cart || [];

  // Find the item in the cart
  let item = cart.find(i => i.id == id);
  if (item) {
    // Fetch product details to check available stock
    const product = await Product.getById(id);
    if (qty > product.quantity) {
      req.flash("error", `Sorry, we only have ${product.quantity} of ${product.productName} in stock.`);
      return res.redirect("/cart");
    }

    // Update the item quantity
    item.quantity = qty;
  }

  req.flash("success", "Quantity updated");
  res.redirect("/cart");
},

  // CLEAR CART
  clearCart: (req, res) => {
    req.session.cart = [];
    req.flash("success", "Cart cleared");
    res.redirect("/cart");
  },

  // CHECKOUT PAGE
  checkout: (req, res) => {
    const cart = req.session.cart || [];

    if (cart.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/shopping');
    }

    const subtotal = cart.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);

    const shipping = 3.99;
    const total = subtotal + shipping;

    res.render("checkout", {
      cart,
      subtotal,
      shipping,
      total
    });
  },

  // SUBMIT CHECKOUT (PLACE ORDER)
  submitCheckout: async (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) {
    req.flash('error', 'Your cart is empty');
    return res.redirect('/shopping');
  }

  const userId = req.session.user.id;
  const address = req.body.address;
  const paymentMethod = req.body.paymentMethod;

  const subtotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);
  const shipping = 3.99;
  const total = subtotal + shipping;

  // 1) Create ORDER
  const orderId = await Order.createOrder(
    userId,
    address,
    paymentMethod,
    subtotal,
    shipping,
    total
  );

  // 2) Insert order items and reduce stock
  for (const item of cart) {
    await Order.addOrderItem(
      orderId,
      item.id,
      item.name,
      item.price,
      item.quantity
    );

    // Reduce stock for each item after adding to order
    await Product.reduceQuantity(item.id, item.quantity, (err) => {
      if (err) {
        console.error(`Failed to reduce quantity for product ${item.id}:`, err);
      }
    });
  }

  // 3) Clear cart
  req.session.cart = [];

  // 4) Redirect to order success page
  res.redirect(`/order-success/${orderId}`);
},

};