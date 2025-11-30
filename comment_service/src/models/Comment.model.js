const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    // Lưu userId dưới dạng String thay vì ObjectId(ref)
    // Vì User nằm ở Database khác (Main DB), service này không thể "populate" sang đó được
    userId: { 
        type: String, 
        required: true,
        index: true 
    }, 

    // Tương tự, videoId cũng chỉ là String tham chiếu
    videoId: { 
        type: String, 
        required: true,
        index: true 
    },

    content: { 
        type: String, 
        required: true,
        trim: true
    },

    // (Mở rộng) Trường này để hỗ trợ Reply comment sau này (Nested Comment)
    // Nếu là comment gốc thì null, nếu là reply thì chứa ID của comment cha
    parentId: {
        type: String,
        default: null,
        index: true
    },

    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// INDEXING QUAN TRỌNG:
// 1. Tìm comment theo video (để hiển thị list): Index videoId + createdAt (giảm dần)
commentSchema.index({ videoId: 1, createdAt: -1 });

// 2. Tìm các reply của 1 comment cha: Index parentId
commentSchema.index({ parentId: 1 });

module.exports = mongoose.model('Comment', commentSchema);