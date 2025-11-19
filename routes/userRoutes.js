
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');

// Routes
router.get('/login', UserController.renderLogin);
router.post('/login', UserController.login);
router.get('/register', UserController.renderRegister);
router.post('/register', UserController.register);
router.get('/logout', UserController.logout);
router.get('/profile', UserController.showProfile);

module.exports = router;

