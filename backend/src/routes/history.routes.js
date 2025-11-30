const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const History = require('../models/History.model');
const mongoose = require('mongoose');

const router = express.Router();

// -------------------------------------------------------------------
// POST /api/history/:videoId (Ghi vào lịch sử xem)
// -------------------------------------------------------------------
router.post('/:videoId', authMiddleware, async (req, res) => {
    const { videoId } = req.params;
    const userId = req.userId;

    try {
        // Upsert: Nếu record tồn tại, chỉ cần cập nhật watchedAt. Nếu không, tạo mới.
        const historyRecord = await History.findOneAndUpdate(
            { userId, videoId },
            { $set: { watchedAt: new Date() } },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Đã cập nhật lịch sử xem.', recordId: historyRecord._id });
    } catch (error) {
        console.error('Lỗi POST /history/:videoId:', error);
        res.status(500).json({ message: 'Ghi lịch sử xem thất bại.' });
    }
});


// -------------------------------------------------------------------
// GET /api/history (Trả danh sách video đã xem)
// -------------------------------------------------------------------
router.get('/', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
        const historyList = await History.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $sort: { watchedAt: -1 } }, // Sắp xếp mới nhất trước
            
            // Lấy thông tin chi tiết video
            { $lookup: {
                from: 'videos',
                localField: 'videoId',
                foreignField: '_id',
                as: 'videoDetails'
            }},
            { $unwind: '$videoDetails' },
            
            // Lấy thông tin kênh (owner) của video
            { $lookup: {
                from: 'users',
                localField: 'videoDetails.ownerId',
                foreignField: '_id',
                as: 'channelDetails'
            }},
            { $unwind: '$channelDetails' },

            { $project: {
                _id: 0,
                watchedAt: 1,
                video: {
                    _id: '$videoDetails._id',
                    title: '$videoDetails.title',
                    thumbnailUrl: '$videoDetails.thumbnailUrl',
                    views: '$videoDetails.stats.views',
                    channelName: '$channelDetails.channelName',
                }
            }}
        ]);

        res.json(historyList);
    } catch (error) {
        console.error('Lỗi GET /history:', error);
        res.status(500).json({ message: 'Lấy lịch sử xem thất bại.' });
    }
});


// -------------------------------------------------------------------
// DELETE /api/history/:videoId (Xóa 1 video khỏi lịch sử)
// -------------------------------------------------------------------
router.delete('/:videoId', authMiddleware, async (req, res) => {
    try {
        const result = await History.deleteOne({
            userId: req.userId,
            videoId: req.params.videoId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Video không có trong lịch sử xem.' });
        }

        res.json({ message: 'Đã xóa video khỏi lịch sử xem.' });
    } catch (error) {
        res.status(500).json({ message: 'Xóa lịch sử thất bại.' });
    }
});


// -------------------------------------------------------------------
// DELETE /api/history (Xóa toàn bộ lịch sử xem)
// -------------------------------------------------------------------
router.delete('/', authMiddleware, async (req, res) => {
    try {
        await History.deleteMany({ userId: req.userId });
        res.json({ message: 'Đã xóa toàn bộ lịch sử xem.' });
    } catch (error) {
        res.status(500).json({ message: 'Xóa toàn bộ lịch sử thất bại.' });
    }
});

module.exports = router;