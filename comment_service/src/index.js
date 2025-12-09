// // src/index.js
// require('dotenv').config();
// const express = require('express');
// const http = require('http');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const { Server } = require('socket.io');
// const Comment = require('./models/Comment.model');

// const app = express();
// const server = http.createServer(app);

// // Cấu hình Socket.IO (Cho phép Frontend và Gateway kết nối)
// const io = new Server(server, {
//     cors: {
//         origin: "*", // Trong production nên giới hạn domain frontend
//         methods: ["GET", "POST"]
//     }
// });

// app.use(cors());
// app.use(express.json());

// // --- DATABASE CONNECTION ---
// mongoose.connect(process.env.MONGO_URI_COMMENT)
//     .then(() => console.log('Comment Service DB Connected'))
//     .catch(err => console.error('DB Connection Error:', err));

// // --- REALTIME SOCKET LOGIC ---
// io.on('connection', (socket) => {
//     console.log(`🔌 Client connected: ${socket.id}`);

//     // Client join vào room của video cụ thể
//     socket.on('join_video', (videoId) => {
//         socket.join(videoId);
//         console.log(`Socket ${socket.id} joined video room: ${videoId}`);
//     });

//     socket.on('disconnect', () => {
//         console.log(`Client disconnected: ${socket.id}`);
//     });
// });


// // --- API HEALTH CHECK (Để Gateway kiểm tra) ---
// app.get('/health', (req, res) => {
//     // Kiểm tra thêm kết nối DB nếu muốn kỹ hơn
//     const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
//     res.status(200).json({
//         service: 'Comment Service',
//         status: 'UP',
//         database: dbStatus,
//         timestamp: new Date()
//     });
// });

// // --- REST API ROUTES ---
// // 1. Lấy danh sách comment (Public)
// app.get('/comments/:videoId', async (req, res) => {
//     try {
//         const { videoId } = req.params;
//         // Lấy danh sách comment, mới nhất lên đầu
//         const comments = await Comment.find({ videoId }).sort({ createdAt: -1 });
//         res.json(comments);
//     } catch (error) {
//         res.status(500).json({ message: 'Error fetching comments' });
//     }
// });

// // 2. Tạo comment mới (Gọi từ Gateway - Internal Use)
// app.post('/comments', async (req, res) => {
//     try {
//         // Dữ liệu này ĐÃ ĐƯỢC verify bởi Gateway trước khi gửi sang đây
//         const { userId, videoId, content, userData } = req.body; 

//         if (!userId || !videoId || !content) {
//             return res.status(400).json({ message: 'Missing required fields' });
//         }

//         const newComment = await Comment.create({ userId, videoId, content });

//         // --- REALTIME EMIT ---
//         // Gửi sự kiện cho tất cả client đang xem video này
//         // Enrich thêm userData (avatar, name) do Gateway gửi sang để Frontend hiển thị ngay
//         const socketData = {
//             ...newComment.toJSON(),
//             user: userData // Dữ liệu user giả lập để hiển thị realtime ngay lập tức
//         };

//         io.to(videoId).emit('receive_comment', socketData);

//         res.status(201).json(newComment);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Error creating comment' });
//     }
// });

// // --- START SERVER ---
// const PORT = process.env.PORT || 3001;
// server.listen(PORT, () => {
//     console.log(`Comment Service running on port ${PORT}`);
// });

// src/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const axios = require('axios'); // <--- 1. THÊM AXIOS

// Import Models
const Comment = require('./models/Comment.model');
const CommentLike = require('./models/CommentLike.model'); // <--- 2. THÊM MODEL LIKE

const app = express();
const server = http.createServer(app);

// <--- 3. KHAI BÁO URL VIDEO SERVICE (Dùng IP 127.0.0.1 để tránh lỗi trên Windows) --->
const VIDEO_SERVICE_URL = 'http://127.0.0.1:3000/api/videos';

// Cấu hình Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI_COMMENT)
    .then(() => console.log('Comment Service DB Connected'))
    .catch(err => console.error('DB Connection Error:', err));

// --- REALTIME SOCKET LOGIC ---
io.on('connection', (socket) => {
    // console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('join_video', (videoId) => {
        socket.join(videoId);
        // console.log(`Socket ${socket.id} joined video room: ${videoId}`);
    });

    socket.on('disconnect', () => {
        // console.log(`Client disconnected: ${socket.id}`);
    });
});

// --- API HEALTH CHECK ---
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    res.status(200).json({
        service: 'Comment Service',
        status: 'UP',
        database: dbStatus,
        timestamp: new Date()
    });
});

// --- REST API ROUTES ---

// 1. Lấy danh sách comment
app.get('/comments/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const comments = await Comment.find({ videoId }).sort({ createdAt: -1 });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments' });
    }
});

// 2. Tạo comment mới (Có gọi cập nhật Stats)
app.post('/comments', async (req, res) => {
    try {
        const { userId, videoId, content, userData } = req.body; 

        if (!userId || !videoId || !content) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const newComment = await Comment.create({ userId, videoId, content });

        // --- REALTIME EMIT ---
        const socketData = {
            ...newComment.toJSON(),
            user: userData 
        };
        io.to(videoId).emit('receive_comment', socketData);

        // <--- 4. GỌI VIDEO SERVICE ĐỂ TĂNG SỐ COMMENT (Async - Không cần await) --->
        axios.post(`${VIDEO_SERVICE_URL}/${videoId}/stats/comments`, { 
            action: 'increment' 
        }).catch(err => console.error("Lỗi đồng bộ stats sang Video Service:", err.message));

        res.status(201).json(newComment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating comment' });
    }
});

// 3. API MỚI: Tương tác Comment (Like/Dislike)
app.post('/comments/:commentId/action', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId, action } = req.body; // action: 'like' hoặc 'dislike'

        if (!['like', 'dislike'].includes(action)) {
            return res.status(400).json({ message: 'Action không hợp lệ' });
        }

        const existingInteraction = await CommentLike.findOne({ userId, commentId });
        const comment = await Comment.findById(commentId);

        if (!comment) return res.status(404).json({ message: 'Comment không tồn tại' });

        if (existingInteraction) {
            // Đã tương tác trước đó
            if (existingInteraction.action === action) {
                // Bấm lại nút cũ -> Hủy
                await CommentLike.findByIdAndDelete(existingInteraction._id);
                if (action === 'like') comment.likesCount = Math.max(0, comment.likesCount - 1);
                else comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
            } else {
                // Đổi trạng thái (Like <-> Dislike)
                existingInteraction.action = action;
                await existingInteraction.save();

                if (action === 'like') {
                    comment.likesCount++;
                    comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
                } else {
                    comment.dislikesCount++;
                    comment.likesCount = Math.max(0, comment.likesCount - 1);
                }
            }
        } else {
            // Chưa tương tác -> Tạo mới
            await CommentLike.create({ userId, commentId, action });
            if (action === 'like') comment.likesCount++;
            else comment.dislikesCount++;
        }

        await comment.save();

        // Gửi Socket update UI Realtime
        io.to(comment.videoId).emit('update_comment_stats', {
            commentId: comment._id,
            likesCount: comment.likesCount,
            dislikesCount: comment.dislikesCount
        });

        res.json({ success: true, likesCount: comment.likesCount });

    } catch (error) {
        console.error("Comment Action Error:", error);
        res.status(500).json({ message: 'Lỗi xử lý tương tác' });
    }
});

// --- START SERVER ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Comment Service running on port ${PORT}`);
});