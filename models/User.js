const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory Array Storage
let usersDB = [];

class ModelQuery {
    constructor(data, isArray = false) {
        this.data = data;
        this.isArray = isArray;
        // In our mock, we won't strictly remove the password field unless requested,
        // Actually, controllers use .select('+password') to bring it back, implying we shouldn't send it by default
        // But for simplicity in an in-memory test, we could just return it. 
        // We'll mimic .select by filtering properties.
    }

    select(fields) {
        if (!this.data) return this;

        const isInclude = Object.keys(fields).length > 0 && typeof fields === 'string' && fields.startsWith('+') ? true : false;
        const fieldList = typeof fields === 'string' ? fields.replace('+', '').split(' ') : [];

        if (this.isArray) {
            this.data = this.data.map(item => this._filterFields(item, fieldList, fields.includes('+')));
        } else {
            this.data = this._filterFields(this.data, fieldList, fields.includes('+'));
        }

        return this;
    }

    _filterFields(item, fieldList, isIncludePassword) {
        if (!item) return item;

        // Create a plain object representation for returning
        const obj = { ...item };
        
        // If it's explicitly selecting just some fields (like select('username email role createdAt'))
        if (fieldList.length > 0 && !isIncludePassword) {
            const filtered = {};
            fieldList.forEach(f => {
                if (obj[f] !== undefined) filtered[f] = obj[f];
            });
            return filtered;
        }

        // If it's select('+password'), we don't need to do anything since our data already has it,
        // Wait, Mongoose hides it. Let's just return the whole object in our mock.
        return obj;
    }

    // Await will just resolve this object since it's an async mock or we can just implement `then()`
    then(resolve, reject) {
        resolve(this.data);
    }
}

class User {
    constructor(data) {
        this._id = data._id || crypto.randomUUID();
        this.username = data.username;
        this.email = data.email;
        this.password = data.password;
        this.role = data.role || 'user';
        this.mfaEnabled = data.mfaEnabled !== undefined ? data.mfaEnabled : true;
        this.mfaMethod = data.mfaMethod || 'email';
        this.totpSecret = data.totpSecret;
        this.mfaOtp = data.mfaOtp;
        this.mfaOtpExpire = data.mfaOtpExpire;
        this.resetPasswordToken = data.resetPasswordToken;
        this.resetPasswordExpire = data.resetPasswordExpire;
        this.createdAt = data.createdAt || new Date();
    }

    async save() {
        // Mock pre-save logic
        // We need a way to detect if password was modified. For simplicity, if it doesn't start with bcrypt prefix ($2a$ or $2b$), we hash it.
        if (this.password && !this.password.startsWith('$2')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }

        // Check if exists
        const index = usersDB.findIndex(u => u._id === this._id);
        if (index > -1) {
            usersDB[index] = this;
        } else {
            usersDB.push(this);
        }
        return this;
    }

    getSignedJwtToken() {
        return jwt.sign({ id: this._id }, process.env.JWT_SECRET || 'fallback_secret_for_dev_only', {
            expiresIn: process.env.JWT_EXPIRE || '30d'
        });
    }

    async matchPassword(enteredPassword) {
        return await bcrypt.compare(enteredPassword, this.password);
    }

    generateMfaOtp() {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        this.mfaOtp = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');
        this.mfaOtpExpire = Date.now() + 10 * 60 * 1000;
        return otp;
    }

    generateResetOtp() {
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash OTP and set to resetPasswordToken field
        this.resetPasswordToken = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');

        // Set expire
        this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

        return otp;
    }

    // Static Mock Methods
    static async create(data) {
        // Mock unique validation constraint
        if(usersDB.some(u => u.email === data.email || u.username === data.username)) {
            const err = new Error('Duplicate field value entered');
            err.code = 11000;
            throw err;
        }
        
        const user = new User(data);
        await user.save();
        return user;
    }

    static findOne(query) {
        let result = null;
        if (query.email) {
            result = usersDB.find(u => u.email === query.email);
        } else if (query.username) {
            result = usersDB.find(u => u.username === query.username);
        }
        
        return new ModelQuery(result ? new User(result) : null);
    }

    static findById(id) {
        const result = usersDB.find(u => u._id === id);
        return new ModelQuery(result ? new User(result) : null);
    }

    static find(query) {
        // Return all since we don't have complex queries in the current controllers
        return new ModelQuery(usersDB.map(u => new User(u)), true);
    }
}

module.exports = User;
