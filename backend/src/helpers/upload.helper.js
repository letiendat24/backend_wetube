// src/helpers/upload.helper.js
const multer = require('multer');
const cloudinary = require('../config/cloudinary.config');

// 1. Cấu hình Multer để lưu trữ file tạm thời trong bộ nhớ (Buffer)
const uploadMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 150 * 1024 * 1024 } // Giới hạn kích thước file (Ví dụ: 150MB)
}).fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]);

// 2. Hàm upload file Buffer lên Cloudinary
const uploadStream = (buffer, resource_type, folderName) => {
    return new Promise((resolve, reject) => {
        // Tạo một upload stream
        const uploadStream = cloudinary.uploader.upload_stream(
            { 
                resource_type: resource_type, // 'video' hoặc 'image'
                folder: folderName, // Thư mục lưu trữ trên Cloudinary
                chunk_size: 6000000, // Cần cho file video lớn
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        // Đẩy buffer file vào stream
        uploadStream.end(buffer);
    });
};

// 3. Middleware chính để xử lý toàn bộ quá trình
const cloudinaryUploadMiddleware = (req, res, next) => {
    // 1. Chạy Multer trước
    uploadMulter(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Lỗi Multer: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ message: `Lỗi Upload: ${err.message}` });
        }

        // Kiểm tra xem có file chưa
        if (!req.files || !req.files.video || !req.files.thumbnail) {
            return res.status(400).json({ message: "Vui lòng cung cấp cả file video và thumbnail." });
        }

        try {
            const videoFile = req.files.video[0];
            const thumbnailFile = req.files.thumbnail[0];

            // 2. Upload video
            const videoResult = await uploadStream(
                videoFile.buffer, 
                'video', 
                `youtube_clone/videos/${req.userId}` // Tạo folder theo userId
            );

            // 3. Upload thumbnail
            const thumbnailResult = await uploadStream(
                thumbnailFile.buffer, 
                'image', 
                `youtube_clone/thumbnails/${req.userId}`
            );

            // 4. Gắn URL vào request để Controller sử dụng
            req.videoUrl = videoResult.secure_url;
            req.thumbnailUrl = thumbnailResult.secure_url;
            
            next();

        } catch (uploadError) {
            console.error('Lỗi Cloudinary Upload:', uploadError);
            return res.status(500).json({ message: 'Tải file lên Cloudinary thất bại.' });
        }
    });
};

module.exports = { cloudinaryUploadMiddleware };