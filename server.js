const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const systemRoutes = require('./routes/systemRoutes');
const errorHandler = require('./middleware/errorMiddleware');

// Security packages
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
// Load environment variables
dotenv.config();

const app = express();

// Security Middleware: Set security headers
app.use(helmet());

// Body parser middleware
app.use(express.json());

// Security Middleware: Prevent XSS attacks
app.use(xss());

// Security Middleware: Rate limiting (Prevent Brute Force)
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 mins
    max: 100, // limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again in 10 minutes.'
});
app.use(limiter);

// Specific stricter rate limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 mins
    max: 1000, // Increased for dev
    message: 'Too many login attempts from this IP, please try again after 10 minutes.'
});
app.use('/api/auth', authLimiter);

// Main entry point for auth routes
app.use('/api/auth', authRoutes);

// Protected System level routes
app.use('/api/system', systemRoutes);

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
