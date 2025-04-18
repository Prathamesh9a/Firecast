const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const { Sequelize } = require('sequelize');
const db = require('../../../models');
const logger = require('../../../Utility/logger'); // Import logger

const router = express.Router();
const SECRET_KEY = "TickerApplication";

// Set up session middleware
router.use(session({
  name: 'session',
  secret: SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 10 * 60 * 60 * 1000 } // 10 hours
}));

// Health Check Route
router.get('/api/health', async (req, res) => {
  try {
    await db.sequelize.authenticate(); // Check database connectivity
    res.status(200).json({ message: 'Server and database are healthy' });
  } catch (error) {
    console.error('Database error:', error);
    logger.log('error', `Error occurred: ${error.message}`);
    res.status(500).json({ message: 'Server is healthy but database is down', error: error.message });
  }
});

// Register Route
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const method = req.method;
  const apiName = req.originalUrl;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const existingUser = await db.User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.User.create({ username, password: hashedPassword });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    logger.log('error', `Error occurred: ${err.message}`);
    logger.logUserActivity( method, apiName, { message: 'Register successful' });
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const method = req.method;
  const apiName = req.originalUrl;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    await db.sequelize.authenticate(); // Check database connectivity

    const user = await db.User.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1d' });
    req.session.userId = user.id;
    req.session.token = token;

    logger.logUserActivity( method, apiName, { message: 'Login successful' });
    res.status(200).json({ message: 'Login successful', token, userId: user.id });
  } catch (err) {
    console.error('Login error:', err);
    if (err instanceof Sequelize.ConnectionError) {
      logger.log('error', `Error occurred: ${err.message}`);
      return res.status(500).json({ message: 'Database connection error' });
    }
    logger.log('error', `Error occurred: ${err.message}`);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
});

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await db.User.findOne({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      logger.log('error', `Error occurred: ${err.message}`);
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
    res.status(500).json({ message: 'Server error during authentication', error: error.message });
    logger.log('error', `Error occurred: ${error.message}`);
  }
};

// Valid User Route
router.get('/validuser', authenticate, async (req, res) => {
  try {
    const { user } = req;
    res.status(200).json({ status: 200, user });
  } catch (error) {
    console.error('Valid user error:', error);
    logger.log('error', `Error occurred: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Token Verification Route
router.post('/verify-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token not provided' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await db.User.findOne({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ message: 'Invalid or expired token', error: err.message });
    logger.log('error', `Error occurred: ${err.message}`);
  }
});

// Logout Route
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;
