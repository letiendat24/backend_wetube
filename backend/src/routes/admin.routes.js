// src/routes/admin.routes.js
const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');

// Models
const User = require('../models/User.model');
const Video = require('../models/Video.model');
// const Comment = require('../../comment_service/src/models/Comment.model'); // Nếu muốn xóa comment (Cần chỉnh đường dẫn nếu comment model nằm ở service khác)
// Lưu ý: Nếu Comment ở Service khác, Admin API nên gọi sang Service đó hoặc xóa trực tiếp trên DB chung nếu dùng chung Cluster.
// Ở đây giả định ta thao tác trên DB chính trước.

const router = express.Router();

// Áp dụng bảo vệ 2 lớp cho TẤT CẢ các route bên dưới
router.use(authMiddleware, adminMiddleware);

// -------------------------------------------------------------------
// 1. DASHBOARD STATS (Thống kê toàn server)
// GET /api/admin/stats
// -------------------------------------------------------------------
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers, totalVideos, totalViews] = await Promise.all([
            User.countDocuments(),
            Video.countDocuments(),
            Video.aggregate([{ $group: { _id: null, total: { $sum: "$stats.views" } } }])
        ]);

        res.json({
            totalUsers,
            totalVideos,
            totalViews: totalViews[0]?.total || 0,
            systemStatus: 'Healthy'
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy thống kê Admin." });
    }
});

// -------------------------------------------------------------------
// 2. USER MANAGEMENT (Quản lý người dùng)
// -------------------------------------------------------------------

// GET /api/admin/users (Lấy danh sách user, có phân trang)
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const users = await User.find()
            .select('-passwordHash') // Không lấy pass
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await User.countDocuments();

        res.json({
            users,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy danh sách user." });
    }
});

// DELETE /api/admin/users/:id (Xóa user & video của họ - Ban nick)
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // 1. Xóa User
        await User.findByIdAndDelete(userId);
        
        // 2. Xóa tất cả Video của User này
        await Video.deleteMany({ ownerId: userId });
        
        // 3. (Nâng cao) Cần xóa Comment, Subscriptions, History liên quan...
        
        res.json({ message: "Đã xóa người dùng và toàn bộ dữ liệu liên quan." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi xóa người dùng." });
    }
});

// -------------------------------------------------------------------
// 3. VIDEO MANAGEMENT (Quản lý Video)
// -------------------------------------------------------------------

// DELETE /api/admin/videos/:id (Xóa video vi phạm)
router.delete('/videos/:id', async (req, res) => {
    try {
        await Video.findByIdAndDelete(req.params.id);
        // TODO: Xóa file trên Cloudinary/S3 (Cần logic gọi API xóa file)
        res.json({ message: "Đã xóa video vi phạm." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi xóa video." });
    }
});

module.exports = router;