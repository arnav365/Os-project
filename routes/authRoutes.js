const express = require('express');
const { register, login, verifyMfa, setupTotp, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Define routes mapped to controller methods
router.post('/register', register);
router.post('/login', login);
router.post('/verify-mfa', verifyMfa);
router.post('/setup-totp', protect, setupTotp);
router.post('/forgotpassword', forgotPassword);
router.post('/resetpassword', resetPassword);

module.exports = router;
