const express = require('express');
const { getSystemStatus, getAllUsers } = require('../controllers/systemController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Fetch System OS Telemetry (Requires any valid authentication)
router.get('/status', protect, getSystemStatus);

// Fetch All Registered Identities (Requires Authentication AND 'admin' role)
router.get('/users', protect, authorize('admin'), getAllUsers);

module.exports = router;
