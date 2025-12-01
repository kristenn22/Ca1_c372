const User = require('../models/User');

module.exports = {
  // RENDER REGISTER PAGE
  renderRegister: (req, res) => {
    res.render('register', { 
      messages: req.flash('error'), 
      formData: req.flash('formData')[0] 
    });
  },

  // REGISTER USER
  register: async (req, res) => {
    try {
      const { username, email, password, address, contact, role } = req.body;

      // Default role if none provided
      const finalRole = role || 'user';

      await User.createUser({ 
        username, 
        email, 
        password, 
        address, 
        contact, 
        role: finalRole 
      });

      req.flash('success', 'Registration successful! Please log in.');
      res.redirect('/login');

    } catch (err) {
      console.error(err);
      req.flash('error', 'Registration failed');
      req.flash('formData', req.body);
      res.redirect('/register');
    }
  },

  // RENDER LOGIN PAGE
  renderLogin: (req, res) => {
    res.render('login', { 
      messages: req.flash('success'), 
      errors: req.flash('error') 
    });
  },

  // LOGIN USER
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
        // Ensure role is normalized to avoid comparison issues
        user.role = user.role ? user.role.toLowerCase().trim() : 'user';

        req.session.user = user;
        console.log("User session stored:", req.session.user);

        req.flash('success', 'Login successful!');


        // REDIRECT BASED ON ROLE
        if (user.role === 'admin') {
          return res.redirect('/adminDashboard');  // admin lands on dashboard
        }

        // Default & normal user redirect
        return res.redirect('/shopping');
      }

      req.flash('error', 'Invalid email or password.');
      res.redirect('/login');

    } catch (err) {
      console.error(err);
      req.flash('error', 'Login failed');
      res.redirect('/login');
    }
  },

  // LOGOUT
  logout: (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  },

  // SHOW PROFILE
  showProfile: (req, res) => {
    const user = req.session.user;

    if (!user) {
      req.flash('error', 'Please log in to view your profile');
      return res.redirect('/login');
    }

    res.render('profile', { user });
  },

  // LIST ALL USERS (admin)
  listUsers: async (req, res) => {
    try {
      const users = await User.getAll();
      return res.render('adminUsers', { users, user: req.session.user });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Unable to load users');
      return res.redirect('/adminDashboard');
    }
  }
};
