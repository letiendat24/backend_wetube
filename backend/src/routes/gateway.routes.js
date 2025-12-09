// const express = require('express');
// const axios = require('axios');
// const authMiddleware = require('../middlewares/auth.middleware');
// const Video = require('../models/Video.model');
// const User = require('../models/User.model');
// const { getServiceStatus } = require('../utils/heathCheck');
// const router = express.Router();
// const COMMENT_SERVICE_URL = process.env.COMMENT_SERVICE_URL || 'http://localhost:3001';

// // POST /api/comments (Tạo Comment)
// // Nhiệm vụ: Auth -> Check Video -> Forward sang Service
// router.post('/', authMiddleware, async (req, res) => {

//     const status = getServiceStatus();
//     if (!status.COMMENT) {
//         return res.status(503).json({ 
//             message: 'Hệ thống bình luận đang bảo trì hoặc quá tải. Vui lòng thử lại sau.' 
//         });
//     }
//     const { videoId, content } = req.body;
//     const userId = req.userId; // Lấy từ authMiddleware

//     try {
//         // 1. Kiểm tra Video có tồn tại không (Logic của Main Service)
//         const video = await Video.findById(videoId);
//         if (!video) {
//             return res.status(404).json({ message: 'Video không tồn tại.' });
//         }

//         // 2. Lấy thông tin User để gửi kèm (Enrich Data)
//         // Comment Service cần thông tin này để emit socket hiển thị ngay avatar/tên
//         const currentUser = await User.findById(userId).select('username avatarUrl channelName');

//         // 3. Forward request sang Comment Service
//         // Đây là bước giao tiếp giữa các service (Service-to-Service)
//         const response = await axios.post(`${COMMENT_SERVICE_URL}/comments`, {
//             userId,
//             videoId,
//             content,
//             userData: { // Gửi kèm để bên kia emit socket
//                 _id: currentUser._id,
//                 username: currentUser.username,
//                 avatarUrl: currentUser.avatarUrl,
//                 channelName: currentUser.channelName
//             }
//         });

//         // 4. Trả kết quả từ Comment Service về cho Frontend
//         res.status(201).json(response.data);

//     } catch (error) {
//         console.error("Lỗi Gateway Comment:", error.message);
//         if (error.response) {
//             // Lỗi từ phía Comment Service trả về
//             return res.status(error.response.status).json(error.response.data);
//         }
//         res.status(500).json({ message: 'Lỗi kết nối đến Comment Service.' });
//     }
// });

// // GET /api/comments/:videoId (Lấy danh sách)
// // Nhiệm vụ: Forward sang Service -> Lấy ID -> Populate User Info
// router.get('/:videoId', async (req, res) => {
//     const status = getServiceStatus();
//     if (!status.COMMENT) {
//         // Nếu service chết, trả về mảng rỗng thay vì lỗi (Failover)
//         // Giúp trang web vẫn load được, chỉ là không thấy comment
//         console.warn("Service Comment die, trả về mảng rỗng fallback");
//         return res.json([]); 
//     }
//     try {
//         const { videoId } = req.params;

//         // 1. Gọi sang Comment Service lấy raw data (chỉ có userId, content)
//         const response = await axios.get(`${COMMENT_SERVICE_URL}/comments/${videoId}`);
//         const rawComments = response.data;

//         // 2. Populate thông tin User (Vì Comment Service không có DB User)
//         // Cách làm: Lấy danh sách userId -> Query DB User -> Map vào comment
//         // (Đây là kỹ thuật Data Aggregation ở tầng Gateway)
        
//         const userIds = [...new Set(rawComments.map(c => c.userId))]; // Lấy unique IDs
//         const users = await User.find({ _id: { $in: userIds } }).select('username avatarUrl channelName');
        
//         // Tạo map để tra cứu nhanh
//         const userMap = {};
//         users.forEach(u => userMap[u._id.toString()] = u);

//         // Gắn thông tin user vào comment
//         const enrichedComments = rawComments.map(comment => ({
//             ...comment,
//             user: userMap[comment.userId] || { username: 'Unknown User', avatarUrl: '' }
//         }));

//         res.json(enrichedComments);

//     } catch (error) {
//         console.error("Lỗi Gateway Get Comments:", error.message);
//         res.status(500).json({ message: 'Lỗi kết nối đến Comment Service.' });
//     }
// });

// module.exports = router;

const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middlewares/auth.middleware');
const Video = require('../models/Video.model');
const User = require('../models/User.model');

// Sửa lại đúng tên file healthCheck (có chữ 'l')
const { getServiceStatus } = require('../utils/heathCheck'); 

const router = express.Router();

// Dùng IP 127.0.0.1 để tránh lỗi treo trên một số máy Windows
const COMMENT_SERVICE_URL = process.env.COMMENT_SERVICE_URL || 'http://127.0.0.1:3001';

// -------------------------------------------------------------------
// 1. POST /api/comments (Tạo Comment)
// Nhiệm vụ: Auth -> Check Video -> Forward sang Service
// -------------------------------------------------------------------
router.post('/', authMiddleware, async (req, res) => {
    // Circuit Breaker: Kiểm tra Service có sống không
    const status = getServiceStatus();
    if (!status.COMMENT) {
        return res.status(503).json({ 
            message: 'Hệ thống bình luận đang bảo trì. Vui lòng thử lại sau.' 
        });
    }

    const { videoId, content } = req.body;
    const userId = req.userId;

    try {
        // 1. Validate: Kiểm tra Video có tồn tại không
        const video = await Video.findById(videoId);
        if (!video) {
            return res.status(404).json({ message: 'Video không tồn tại.' });
        }

        // 2. Data Enrichment: Lấy thông tin User để gửi kèm
        const currentUser = await User.findById(userId).select('username avatarUrl channelName');

        // 3. Forward request sang Comment Service
        // Gateway CHỈ chuyển tiếp, KHÔNG tự ý update DB Video (Decoupled)
        const response = await axios.post(`${COMMENT_SERVICE_URL}/comments`, {
            userId,
            videoId,
            content,
            userData: { 
                _id: currentUser._id,
                username: currentUser.username,
                avatarUrl: currentUser.avatarUrl,
                channelName: currentUser.channelName
            }
        });

        res.status(201).json(response.data);

    } catch (error) {
        console.error("Gateway Error (Create Comment):", error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ message: 'Lỗi kết nối đến Comment Service.' });
    }
});

// -------------------------------------------------------------------
// 2. GET /api/comments/:videoId (Lấy danh sách)
// Nhiệm vụ: Forward sang Service -> Lấy ID -> Populate User Info
// -------------------------------------------------------------------
router.get('/:videoId', async (req, res) => {
    const status = getServiceStatus();
    if (!status.COMMENT) {
        // Failover: Trả về rỗng để trang web không bị lỗi crash
        return res.json([]); 
    }

    try {
        const { videoId } = req.params;

        // 1. Gọi sang Comment Service lấy dữ liệu thô
        const response = await axios.get(`${COMMENT_SERVICE_URL}/comments/${videoId}`);
        const rawComments = response.data;

        // 2. Populate User Info (Gateway Aggregation)
        // Lấy danh sách ID người dùng từ các comment
        const userIds = [...new Set(rawComments.map(c => c.userId))]; 
        
        // Truy vấn DB User của Gateway
        const users = await User.find({ _id: { $in: userIds } }).select('username avatarUrl channelName');
        
        // Map data
        const userMap = {};
        users.forEach(u => userMap[u._id.toString()] = u);

        const enrichedComments = rawComments.map(comment => ({
            ...comment,
            user: userMap[comment.userId] || { username: 'Unknown', avatarUrl: '' }
        }));

        res.json(enrichedComments);

    } catch (error) {
        console.error("Gateway Error (Get Comments):", error.message);
        // Trả về rỗng thay vì lỗi 500 để UI vẫn hiển thị được video
        res.json([]); 
    }
});

// -------------------------------------------------------------------
// 3. POST /api/comments/:commentId/action (Like/Dislike Comment)
// Nhiệm vụ: Forward hành động tương tác sang Service
// -------------------------------------------------------------------
router.post('/:commentId/action', authMiddleware, async (req, res) => {
    const status = getServiceStatus();
    if (!status.COMMENT) {
        return res.status(503).json({ message: 'Tính năng tương tác đang bảo trì.' });
    }

    try {
        const { commentId } = req.params;
        const { action } = req.body; // 'like' | 'dislike'
        const userId = req.userId;

        // Forward sang Comment Service
        const response = await axios.post(`${COMMENT_SERVICE_URL}/comments/${commentId}/action`, {
            userId, 
            action
        });

        res.json(response.data);

    } catch (error) {
        console.error("Gateway Error (Action):", error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ message: 'Lỗi kết nối đến Comment Service.' });
    }
});

module.exports = router;