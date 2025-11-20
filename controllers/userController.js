const User = require('../models/User');

module.exports = {
  renderRegister: (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
  },

  register: async (req, res) => {
    try {
      const { username, email, password, address, contact, role } = req.body;
      await User.createUser({ username, email, password, address, contact, role });
      req.flash('success', 'Registration successful! Please log in.');
      res.redirect('/login');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Registration failed');
      req.flash('formData', req.body);
      res.redirect('/register');
    }
  },

  renderLogin: (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log('Login attempt for:', email);
      if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
      }
      const user = await User.findByEmailAndPassword(email, password);
      console.log('Login result user:', !!user);
      if (user) {
        req.session.user = user;
        req.flash('success', 'Login successful!');
        if (req.session.user.role == 'user') return res.redirect('/shopping');
        return res.redirect('/products');
      }
      req.flash('error', 'Invalid email or password.');
      res.redirect('/login');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Login failed');
      res.redirect('/login');
    }
  },

  logout: (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
,

  showProfile: (req, res) => {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to view your profile');
      return res.redirect('/login');
    }
    res.render('profile', { user });
  }
};
