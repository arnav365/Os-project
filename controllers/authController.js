const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { username, email, password, role } = req.body;

        // Validation -> ensure all fields exist
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        const user = await User.create({
            username,
            email,
            password,
            role: role || 'user'
        });

        // Enforce MFA matching login flow
        if (user.mfaEnabled) {
            const otpCode = user.generateMfaOtp();
            await user.save({ validateBeforeSave: false });

            try {
                await sendEmail({
                    email: user.email,
                    subject: 'Your Account Activation OTP',
                    message: `Welcome to the system! Please use the following OTP to verify your account and login: ${otpCode}. It expires in 10 minutes.`,
                    rawOtp: otpCode
                });

                return res.status(200).json({
                    success: true,
                    mfaRequired: true,
                    mfaMethod: 'email',
                    userId: user._id,
                    message: 'Account initialized. An OTP has been sent to your email to verify identity.'
                });
            } catch (err) {
                user.mfaOtp = undefined;
                user.mfaOtpExpire = undefined;
                await user.save({ validateBeforeSave: false });
                return res.status(500).json({ success: false, message: 'Failed to send OTP email during registration.' });
            }
        }

        sendTokenResponse(user, 201, res);

    } catch (error) {
        // Forward error to error middleware (e.g. ValidationError)
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        // Check for user (select password to explicitly fetch it)
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if password matches using model method
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // ----- MFA Implementation -----
        // If MFA is enabled, check method
        if (user.mfaEnabled) {
            
            // Branch 1: TOTP (Google Authenticator)
            if (user.mfaMethod === 'totp' && user.totpSecret) {
                return res.status(200).json({
                    success: true,
                    mfaRequired: true,
                    mfaMethod: 'totp',
                    userId: user._id,
                    message: 'Please provide your Authenticator code.'
                });
            }
            
            // Branch 2: Default to Email
            const otpCode = user.generateMfaOtp();
            await user.save({ validateBeforeSave: false });

            try {
                await sendEmail({
                    email: user.email,
                    subject: 'Your Secure Login OTP',
                    message: `Please use the following OTP to complete your login: ${otpCode}. It expires in 10 minutes.`,
                    rawOtp: otpCode
                });

                return res.status(200).json({
                    success: true,
                    mfaRequired: true,
                    mfaMethod: 'email',
                    userId: user._id,
                    message: 'MFA required. An OTP has been sent to your email.'
                });
            } catch (err) {
                user.mfaOtp = undefined;
                user.mfaOtpExpire = undefined;
                await user.save({ validateBeforeSave: false });
                return res.status(500).json({ success: false, message: 'Failed to send OTP email' });
            }
        }

        // If no MFA, fallback to standard response (not typical under our new forced configuration, but safe fallback)
        sendTokenResponse(user, 200, res);

    } catch (error) {
        next(error);
    }
};

// @desc    Verify MFA OTP and finalize login
// @route   POST /api/auth/verify-mfa
// @access  Public
exports.verifyMfa = async (req, res, next) => {
    try {
        const { userId, otp } = req.body;

        if (!userId || !otp) {
            return res.status(400).json({ success: false, message: 'Please provide user ID and OTP.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid User Identifier.' });
        }

        // Branch 1: Verify TOTP setup
        if (user.mfaMethod === 'totp' && user.totpSecret) {
            const isVerified = speakeasy.totp.verify({
                secret: user.totpSecret,
                encoding: 'base32',
                token: otp,
                window: 1 // Allow 30 seconds drift (+/-)
            });

            if (!isVerified) {
                return res.status(401).json({ success: false, message: 'Invalid Authenticator code.' });
            }
            
        } else {
            // Branch 2: Verify DB Email Hash
            const hashedOtp = crypto
                .createHash('sha256')
                .update(otp)
                .digest('hex');

            // Verify Hash and Expiry matches
            if (user.mfaOtp !== hashedOtp || user.mfaOtpExpire < Date.now()) {
                return res.status(401).json({ success: false, message: 'Invalid or expired OTP.' });
            }

            // MFA Successful -> Clean up DB
            user.mfaOtp = undefined;
            user.mfaOtpExpire = undefined;
            await user.save({ validateBeforeSave: false });
        }

        // Finally issue the JWT to allow access
        sendTokenResponse(user, 200, res);

    } catch (error) {
        next(error);
    }
};

// Helper function to get token from model, create response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = user.getSignedJwtToken();

    res.status(statusCode).json({
        success: true,
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    });
};

// @desc    Setup Google Authenticator TOTP
// @route   POST /api/auth/setup-totp
// @access  Private (Requires valid JWT)
exports.setupTotp = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate a new secret using speakeasy
        const secret = speakeasy.generateSecret({ 
            length: 20,
            name: `SecureOS (${user.email})`
        });

        // Store secret and toggle MFA method to TOTP
        user.totpSecret = secret.base32;
        user.mfaMethod = 'totp';
        await user.save({ validateBeforeSave: false });

        // Generate the QR Code so user can immediately scan it
        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to generate QR code' });
            }

            res.status(200).json({
                success: true,
                message: 'Google Authenticator setup successful. Please scan the QR code.',
                secret: secret.base32,
                qrcode: data_url
            });
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        const userQuery = await User.findOne({ email: req.body.email });
        const user = userQuery; 

        if (!user) {
            return res.status(404).json({ success: false, message: 'There is no user with that email' });
        }

        // Get reset OTP
        const resetOtp = user.generateResetOtp();
        await user.save();

        const message = `A password reset has been requested for your account. Please use the following Security OTP to reset your password:\n\nOTP: ${resetOtp}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Security Key Reset OTP',
                message
            });

            // Note: Returning resetOtp in response purely for debugging/mock testing convenience since this is a local simulated project
            res.status(200).json({ success: true, data: 'Email sent', resetOtp }); 
        } catch (err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();

            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Reset password
// @route   POST /api/auth/resetpassword
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        if (!req.body.otp || !req.body.password) {
            return res.status(400).json({ success: false, message: 'Provide OTP and new password' });
        }

        // Get hashed token from submitted OTP
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.body.otp)
            .digest('hex');

        // Find user by token and verify it hasn't expired
        const allUsers = await User.find({});
        const user = allUsers.find(u => u.resetPasswordToken === resetPasswordToken && u.resetPasswordExpire > Date.now());

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        // Set new password
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        sendTokenResponse(user, 200, res);
    } catch (error) {
        next(error);
    }
};
