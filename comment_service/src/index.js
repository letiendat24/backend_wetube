// src/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const Comment = require('./models/Comment.model');

const app = express();
const server = http.createServer(app);

// Cấu hình Socket.IO (Cho phép Frontend và Gateway kết nối)
const io = new Server(server, {
    cors: {
        origin: "*", // Trong production nên giới hạn domain frontend
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
    console.log(`🔌 Client connected: ${socket.id}`);

    // Client join vào room của video cụ thể
    socket.on('join_video', (videoId) => {
        socket.join(videoId);
        console.log(`Socket ${socket.id} joined video room: ${videoId}`);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});


// --- API HEALTH CHECK (Để Gateway kiểm tra) ---
app.get('/health', (req, res) => {
    // Kiểm tra thêm kết nối DB nếu muốn kỹ hơn
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    res.status(200).json({
        service: 'Comment Service',
        status: 'UP',
        database: dbStatus,
        timestamp: new Date()
    });
});

// --- REST API ROUTES ---
// 1. Lấy danh sách comment (Public)
app.get('/comments/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        // Lấy danh sách comment, mới nhất lên đầu
        const comments = await Comment.find({ videoId }).sort({ createdAt: -1 });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments' });
    }
});

// 2. Tạo comment mới (Gọi từ Gateway - Internal Use)
app.post('/comments', async (req, res) => {
    try {
        // Dữ liệu này ĐÃ ĐƯỢC verify bởi Gateway trước khi gửi sang đây
        const { userId, videoId, content, userData } = req.body; 

        if (!userId || !videoId || !content) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const newComment = await Comment.create({ userId, videoId, content });

        // --- REALTIME EMIT ---
        // Gửi sự kiện cho tất cả client đang xem video này
        // Enrich thêm userData (avatar, name) do Gateway gửi sang để Frontend hiển thị ngay
        const socketData = {
            ...newComment.toJSON(),
            user: userData // Dữ liệu user giả lập để hiển thị realtime ngay lập tức
        };

        io.to(videoId).emit('receive_comment', socketData);

        res.status(201).json(newComment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating comment' });
    }
});

// --- START SERVER ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Comment Service running on port ${PORT}`);
});