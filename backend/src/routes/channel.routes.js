// src/routes/channel.routes.js
const express = require('express');
const mongoose = require('mongoose'); // Cần import mongoose để dùng Transaction
const authMiddleware = require('../middlewares/auth.middleware');

const User = require('../models/User.model');
const Video = require('../models/Video.model');
const Subscription = require('../models/Subscription.model');

const router = express.Router();


router.get('/my-subscriptions', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;

        // Tìm trong bảng Subscription xem userId này đang subscribe ai
        const subscriptions = await Subscription.find({ subscriberId: userId })
            .sort({ createdAt: -1 }) // Mới nhất lên đầu
            .populate('channelId', 'channelName avatarUrl subscribersCount'); // Lấy thông tin kênh

        // Map lại dữ liệu cho gọn (nếu cần)
        const channels = subscriptions.map(sub => {
            // Kiểm tra null (phòng trường hợp kênh đó bị xóa nhưng sub chưa xóa)
            if (!sub.channelId) return null;
            return {
                _id: sub.channelId._id,
                channelName: sub.channelId.channelName,
                avatarUrl: sub.channelId.avatarUrl,
                subscribersCount: sub.channelId.subscribersCount,
                subscribedAt: sub.createdAt
            };
        }).filter(item => item !== null); // Lọc bỏ null

        res.json(channels);
    } catch (error) {
        console.error("Lỗi GET /channels/my-subscriptions:", error);
        res.status(500).json({ message: "Lỗi lấy danh sách đăng ký." });
    }
});


// GET /api/channels/:channelId (Lấy thông tin kênh và 10 video mới nhất)
router.get('/:channelId', async (req, res) => {
    const { channelId } = req.params;

    try {
        // 1. Lấy thông tin kênh
        const channel = await User.findById(channelId).select('-passwordHash -email');

        if (!channel || !channel.isChannel) {
            return res.status(404).json({ message: 'Kênh không tồn tại.' });
        }

        // 2. Lấy 10 video công khai mới nhất của kênh
        const latestVideos = await Video.find({ 
            ownerId: channelId,
            visibility: 'public' // Chỉ hiển thị video công khai
        })
        .sort({ createdAt: -1 })
        .limit(10);
        
        // 3. Trả về kết quả
        res.json({
            channel: channel.toJSON(),
            latestVideos
        });

    } catch (error) {
        console.error('Lỗi GET /channels/:channelId:', error);
        res.status(500).json({ message: 'Lỗi server nội bộ.' });
    }
});

// GET /api/channels/:channelId/subscribers (Tạm thời là skeleton)
router.get('/:channelId/subscribers', async (req, res) => {
    // Sẽ cần logic $lookup trên collection Subscriptions ở bước sau
    res.status(501).json({ message: 'Chức năng danh sách Subscriber chưa được triển khai.' });
});

// POST /api/channels/:channelId/subscribe
// Dùng authMiddleware vì chỉ user đã đăng nhập mới subscribe được
router.post('/:channelId/subscribe', authMiddleware, async (req, res) => {
    const { channelId } = req.params;
    const subscriberId = req.userId; // ID của người thực hiện hành động

    if (subscriberId.toString() === channelId) {
        return res.status(400).json({ message: 'Bạn không thể tự đăng ký kênh của mình.' });
    }

    // Bắt đầu Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Kiểm tra xem kênh có tồn tại không
        const channel = await User.findById(channelId).session(session);
        if (!channel) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Kênh không tồn tại.' });
        }
        
        // 2. Tạo record Subscription
        const newSub = await Subscription.create([{
            subscriberId,
            channelId,
        }], { session });

        if (!newSub || newSub.length === 0) {
            await session.abortTransaction();
            return res.status(409).json({ message: 'Bạn đã đăng ký kênh này rồi.' }); // Hoặc lỗi unique
        }

        // 3. Tăng subscribersCount của kênh
        await User.findByIdAndUpdate(
            channelId,
            { $inc: { subscribersCount: 1 } },
            { session }
        );

        // 4. Commit Transaction
        await session.commitTransaction();
        res.status(201).json({ message: 'Đăng ký kênh thành công!' });

    } catch (error) {
        await session.abortTransaction();
        console.error('Lỗi Subscribe:', error);
        
        // Xử lý lỗi unique (nếu user đã subscribe trước đó)
        if (error.code === 11000) {
             return res.status(409).json({ message: 'Bạn đã đăng ký kênh này rồi.' });
        }
        res.status(500).json({ message: 'Đăng ký thất bại. Lỗi server nội bộ.' });
    } finally {
        session.endSession();
    }
});

// DELETE /api/channels/:channelId/subscribe
router.delete('/:channelId/subscribe', authMiddleware, async (req, res) => {
    const { channelId } = req.params;
    const subscriberId = req.userId;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Xóa record Subscription
        const result = await Subscription.deleteOne({
            subscriberId,
            channelId,
        }).session(session);

        if (result.deletedCount === 0) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Bạn chưa đăng ký kênh này.' });
        }

        // 2. Giảm subscribersCount của kênh
        await User.findByIdAndUpdate(
            channelId,
            { $inc: { subscribersCount: -1 } },
            { session }
        );

        // 3. Commit Transaction
        await session.commitTransaction();
        res.json({ message: 'Hủy đăng ký kênh thành công!' });

    } catch (error) {
        await session.abortTransaction();
        console.error('Lỗi Unsubscribe:', error);
        res.status(500).json({ message: 'Hủy đăng ký thất bại. Lỗi server nội bộ.' });
    } finally {
        session.endSession();
    }
});

module.exports = router;