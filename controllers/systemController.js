const User = require('../models/User');

// @desc    Get mock system status/telemetry
// @route   GET /api/system/status
// @access  Private (Logged in users only)
exports.getSystemStatus = async (req, res) => {
    try {
        // In a real OS you would utilize modules like 'os' or 'si' to get actual platform data.
        // For starter framework, we return mock telemetry.
        const telemetry = {
            os_version: 'AntigravityOS v2.0.1',
            uptime: '14 days, 2 hours',
            cpu_usage: `${Math.floor(Math.random() * 20 + 10)}%`, // Mock dynamic load 10-30%
            memory_usage: '4.2GB / 16.0GB',
            disk_health: 'Optimal',
            active_sessions: Math.floor(Math.random() * 3 + 1),
            network_status: 'Securely Encrypted'
        };

        res.status(200).json({ success: true, data: telemetry });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error retrieving telemetry' });
    }
};

// @desc    Get all registered users on network
// @route   GET /api/system/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
    try {
        // Query database for all users, explicitly formatting the result without sensitive data
        const users = await User.find({}).select('username email role createdAt');

        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error retrieving users' });
    }
};
