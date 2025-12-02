const Product = require('../models/Products');
const Order = require('../models/order');
const Cart = require('../models/Cart');

// Normalize user id across possible column names
const getUserId = (req) => req.session?.user?.id
  ?? req.session?.user?.userId
  ?? req.session?.user?.ID;

// Ensure the in-memory session cart mirrors what's stored in the DB
const loadCartFromStore = async (req) => {
  const userId = getUserId(req);
  if (!userId) {
    req.session.cart = req.session.cart || [];
    return req.session.cart;
  }

  // Always load fresh from DB so persisted carts show up even after logout/login
  const items = await Cart.getCart(userId);
  req.session.cart = items;
  return items;
};

module.exports = {
// ADD TO CART
addToCart: async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      req.flash("error", "No user ID found. Please log in again.");
      return res.redirect("/login");
    }
    const id = req.body.productId;
    const quantity = parseInt(req.body.quantity, 10) || 1;

    const product = await Product.getById(id);
    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect("/shopping");
    }

    const cart = await loadCartFromStore(req);
    const existing = cart.find(item => item.id == id);
    const newQuantity = (existing ? existing.quantity : 0) + quantity;

    if (newQuantity > product.quantity) {
      req.flash("error", `Sorry, we only have ${product.quantity} of ${product.productName} in stock.`);
      return res.redirect("/shopping");
    }

    if (existing) {
      existing.quantity = newQuantity;
    } else {
      cart.push({
        id: product.id,
        name: product.productName,
        price: product.price,
        image: product.image,
        quantity: newQuantity
      });
    }

    await Cart.upsertItem(userId, product.id, newQuantity);

    // Refresh from DB to be sure persistence worked
    req.session.cart = await Cart.getCart(userId);
    console.log(`Cart for user ${userId} now has ${req.session.cart.length} item(s)`);

    req.flash("success", `${product.productName} added to cart`);
    return res.redirect("/shopping");
  } catch (err) {
    console.error("Failed to add to cart:", err);
    req.flash("error", "Could not add item to cart");
    return res.redirect("/shopping");
  }
},

  //show cart
  showCart: async (req, res) => {
    try {
      const cart = await loadCartFromStore(req);
      return res.render("cart", { cart });
    } catch (err) {
      console.error("Failed to load cart:", err);
      req.flash("error", "Could not load cart");
      return res.redirect("/shopping");
    }
  },

  //remove item from cart
  removeItem: async (req, res) => {
    const id = req.params.id;
    const userId = getUserId(req);
    try {
      const cart = await loadCartFromStore(req);
      req.session.cart = cart.filter(item => item.id != id);
      await Cart.removeItem(userId, id);

      req.flash("success", "Item removed");
    } catch (err) {
      console.error("Failed to remove item from cart:", err);
      req.flash("error", "Could not remove item from cart");
    }
    res.redirect("/cart");
  },

  //update quantity
updateQuantity: async (req, res) => {
  const id = req.params.id;
  const qty = parseInt(req.body.quantity, 10);
  const userId = getUserId(req);
  if (!userId) {
    req.flash("error", "No user ID found. Please log in again.");
    return res.redirect("/login");
  }

  try {
    const cart = await loadCartFromStore(req);
    let item = cart.find(i => i.id == id);
    if (!item) {
      req.flash("error", "Item not found in cart");
      return res.redirect("/cart");
    }

    // Fetch product details to check available stock
    const product = await Product.getById(id);
    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect("/cart");
    }
    if (qty > product.quantity) {
      req.flash("error", `Sorry, we only have ${product.quantity} of ${product.productName} in stock.`);
      return res.redirect("/cart");
    }

    if (qty <= 0) {
      req.session.cart = cart.filter(i => i.id != id);
      await Cart.removeItem(userId, id);
      req.flash("success", "Item removed");
      return res.redirect("/cart");
    }

    // Update the item quantity
    item.quantity = qty;
    await Cart.upsertItem(userId, id, qty);

    req.flash("success", "Quantity updated");
    return res.redirect("/cart");
  } catch (err) {
    console.error("Failed to update quantity:", err);
    req.flash("error", "Could not update quantity");
    return res.redirect("/cart");
  }
},

  // CLEAR CART
  clearCart: async (req, res) => {
    const userId = getUserId(req);
    try {
      req.session.cart = [];
      await Cart.clearCart(userId);
      req.flash("success", "Cart cleared");
    } catch (err) {
      console.error("Failed to clear cart:", err);
      req.flash("error", "Could not clear cart");
    }
    res.redirect("/cart");
  },

  // CHECKOUT PAGE
  checkout: async (req, res) => {
    try {
      const cart = await loadCartFromStore(req);

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
    } catch (err) {
      console.error("Failed to load checkout:", err);
      req.flash("error", "Could not load checkout");
      return res.redirect("/shopping");
    }
  },

  // SUBMIT CHECKOUT (PLACE ORDER)
  submitCheckout: async (req, res) => {
  try {
    const cart = await loadCartFromStore(req);
    if (cart.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/shopping');
    }

    const userId = getUserId(req);
    if (!userId) {
      req.flash("error", "No user ID found. Please log in again.");
      return res.redirect("/login");
    }
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

    // 3) Clear cart (session + persistent)
    req.session.cart = [];
    await Cart.clearCart(userId);

    // 4) Redirect to order success page
    res.redirect(`/order-success/${orderId}`);
  } catch (err) {
    console.error("Failed to submit checkout:", err);
    req.flash("error", "Could not complete checkout");
    return res.redirect("/cart");
  }
},

};
