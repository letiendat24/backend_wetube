// src/routes/auth.routes.js
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User.model');
const { generateToken } = require('../utils/jwt.utils');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { email, password, username, channelName } = req.body;
    
    // Validation cơ bản
    if (!email || !password || !username || !channelName) {
        return res.status(400).json({ message: 'Vui lòng điền đủ Email, Mật khẩu, Username và Tên kênh.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    try {
        // Hash mật khẩu
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Tạo User mới
        const newUser = await User.create({
            email,
            passwordHash,
            username,
            channelName,
        });

        // Tạo JWT và trả về
        const token = generateToken(newUser._id);
        res.status(201).json({ 
            token, 
            user: newUser.toJSON() // Sử dụng toJSON() đã tùy chỉnh
        });

    } catch (error) {
        // Xử lý lỗi unique (11000)
        if (error.code === 11000) {
            const field = error.keyPattern.email ? 'Email' : 'Tên kênh';
            return res.status(409).json({ message: `${field} đã được sử dụng.` });
        }
        console.error('Lỗi Đăng ký:', error);
        res.status(500).json({ message: 'Đăng ký thất bại. Vui lòng thử lại.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Tìm User
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ.' });
        }

        // 2. So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ.' });
        }

        // 3. Tạo JWT và trả về
        const token = generateToken(user._id);
        res.json({ 
            token, 
            user: user.toJSON() 
        });

    } catch (error) {
        console.error('Lỗi Đăng nhập:', error);
        res.status(500).json({ message: 'Đăng nhập thất bại.' });
    }
});

module.exports = router;