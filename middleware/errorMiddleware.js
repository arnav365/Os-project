const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log to console for developer
    console.error(err.stack);

    // Handle Duplicate key (from custom mocked Model)
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = { statusCode: 400, message };
    }

    res.status(error.statusCode || res.statusCode === 200 ? 500 : res.statusCode).json({
        success: false,
        message: error.message || 'Server Error'
    });
};

module.exports = errorHandler;
