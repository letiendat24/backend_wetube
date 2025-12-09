const express = require('express');
const User = require('../models/User.model');
const Video = require('../models/Video.model');
const authMiddleware = require('../middlewares/auth.middleware');
const mongoose = require('mongoose');
const router = express.Router();

router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const ownerObjectId = new mongoose.Types.ObjectId(userId);

        // 1. Aggregation trên bảng Video để tính tổng các chỉ số
        const stats = await Video.aggregate([
            // Bước 1: Lọc ra tất cả video của user này (kể cả private)
            { $match: { ownerId: ownerObjectId } },

            // Bước 2: Nhóm và tính tổng các chỉ số
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalViews: { $sum: "$stats.views" },
                    totalLikes: { $sum: "$stats.likes" },
                    totalDislikes: { $sum: "$stats.dislikes" },
                    // Lưu ý: Nếu Video Model chưa có field comments, cái này sẽ là 0
                    totalComments: { $sum: "$stats.comments" } 
                }
            }
        ]);

        // 2. Lấy thông tin kênh để lấy số sub
        const channel = await User.findById(userId).select('subscribersCount');

        // 3. Xử lý kết quả (Nếu user chưa có video nào, stats sẽ là mảng rỗng)
        const result = stats[0] || {
            totalVideos: 0,
            totalViews: 0,
            totalLikes: 0,
            totalDislikes: 0,
            totalComments: 0
        };

        // 4. Trả về kết quả tổng hợp
        res.json({
            totalSubscribers: channel ? channel.subscribersCount : 0,
            ...result
        });

    } catch (error) {
        console.error("Lỗi GET /stats/dashboard:", error);
        res.status(500).json({ message: "Lỗi lấy thống kê dashboard." });
    }
});
// GET /api/stats/channel/:channelId (Tổng quan kênh)
// -------------------------------------------------------------------
router.get('/channel/:channelId', async (req, res) => {
    const { channelId } = req.params;

    try {
        const ownerObjectId = new mongoose.Types.ObjectId(channelId);

        // 1. Lấy thông tin cơ bản kênh
        const channelInfo = await User.findById(channelId).select('subscribersCount channelName');

        if (!channelInfo) {
            return res.status(404).json({ message: 'Kênh không tồn tại.' });
        }

        // 2. Lấy tổng số video và tổng số views từ tất cả video của kênh
        const videoStats = await Video.aggregate([
            { $match: { ownerId: ownerObjectId, visibility: 'public' } }, // Chỉ tính video public
            { $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                totalViews: { $sum: '$stats.views' }
            }}
        ]);
        
        const stats = {
            channelName: channelInfo.channelName,
            totalSubscribers: channelInfo.subscribersCount,
            totalVideos: videoStats.length > 0 ? videoStats[0].totalVideos : 0,
            totalViews: videoStats.length > 0 ? videoStats[0].totalViews : 0
        };

        res.json(stats);

    } catch (error) {
        console.error('Lỗi GET /stats/channel:', error);
        res.status(500).json({ message: 'Lấy thống kê kênh thất bại.' });
    }
});


// -------------------------------------------------------------------
// GET /api/stats/video/:videoId (Thống kê chi tiết video)
// -------------------------------------------------------------------
router.get('/video/:videoId', async (req, res) => {
    try {
        const video = await Video.findById(req.params.videoId).select('stats title');

        if (!video) {
            return res.status(404).json({ message: 'Video không tồn tại.' });
        }

        res.json({
            title: video.title,
            views: video.stats.views,
            likes: video.stats.likes,
            dislikes: video.stats.dislikes,
        });
    } catch (error) {
        console.error('Lỗi GET /stats/video:', error);
        res.status(500).json({ message: 'Lấy thống kê video thất bại.' });
    }
});

module.exports = router;