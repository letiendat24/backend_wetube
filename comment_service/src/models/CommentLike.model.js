const mongoose = require('mongoose');

const commentLikeSchema = new mongoose.Schema({
    // Lưu userId dưới dạng String (vì User nằm ở DB khác)
    userId: { 
        type: String, 
        required: true, 
        index: true 
    },
    
    // ID của comment được like/dislike
    commentId: { 
        type: String, 
        required: true, 
        index: true 
    },

    // Loại hành động: chỉ chấp nhận 'like' hoặc 'dislike'
    action: { 
        type: String, 
        enum: ['like', 'dislike'], 
        required: true 
    }
}, { timestamps: true });

// INDEX QUAN TRỌNG:
// Đảm bảo 1 user chỉ có thể có 1 trạng thái cho 1 comment cụ thể.
// (Ví dụ: Đã like rồi thì record này tồn tại, muốn dislike thì phải update record này, không tạo mới trùng lặp)
commentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true });

module.exports = mongoose.model('CommentLike', commentLikeSchema);