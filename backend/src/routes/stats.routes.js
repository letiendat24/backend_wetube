const express = require('express');
const User = require('../models/User.model');
const Video = require('../models/Video.model');
const mongoose = require('mongoose');

const router = express.Router();

// -------------------------------------------------------------------
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