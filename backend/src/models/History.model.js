// src/models/History.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const historySchema = new mongoose.Schema({
    userId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        description: 'ID của người xem'
    },
    videoId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Video', 
        required: true,
        description: 'ID của video đã xem'
    },
    // Trường watchedAt được cập nhật mỗi lần xem (sử dụng upsert)
    watchedAt: { 
        type: Date, 
        default: Date.now 
    }, 
}, { timestamps: false }); // Tắt timestamps mặc định, chỉ dùng watchedAt

// Index cho lịch sử xem (sort by watchedAt DESC)
// Đảm bảo chỉ có 1 record lịch sử cho mỗi video/user
historySchema.index({ userId: 1, videoId: 1 }, { unique: true });
historySchema.index({ userId: 1, watchedAt: -1 });

module.exports = mongoose.model('History', historySchema);