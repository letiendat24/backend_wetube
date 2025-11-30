// src/utils/jwt.utils.js
const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

// Hàm xác minh token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null; // Trả về null nếu token không hợp lệ/hết hạn
    }
};

module.exports = { generateToken, verifyToken };