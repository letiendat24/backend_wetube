// src/routes/user.routes.js
const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const User = require('../models/User.model');

const router = express.Router();

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại.' });
        res.json(user.toJSON());
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server nội bộ.' });
    }
});

// PATCH /api/users/me
router.patch('/me', authMiddleware, async (req, res) => {
    const { username, avatarUrl, channelName, channelDescription } = req.body;
    
    // Tạo object chứa các trường cần update
    const updates = {};
    if (username) updates.username = username;
    if (avatarUrl) updates.avatarUrl = avatarUrl;
    if (channelName) updates.channelName = channelName;
    if (channelDescription) updates.channelDescription = channelDescription;
    
    // Kiểm tra nếu không có gì để update
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'Không có dữ liệu nào được cung cấp để cập nhật.' });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.userId,
            { $set: updates },
            { new: true, runValidators: true } // new: trả về tài liệu mới, runValidators: kiểm tra unique
        );

        if (!updatedUser) return res.status(404).json({ message: 'Người dùng không tồn tại.' });

        res.json(updatedUser.toJSON());

    } catch (error) {
        // Xử lý lỗi unique (channelName đã tồn tại)
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Tên kênh đã được sử dụng.' });
        }
        res.status(500).json({ message: 'Cập nhật thất bại.' });
    }
});

module.exports = router;