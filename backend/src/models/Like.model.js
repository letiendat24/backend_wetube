// src/models/Like.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const likeSchema = new mongoose.Schema({
    userId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        description: 'ID của người thực hiện like/dislike'
    },
    videoId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Video', 
        required: true,
        description: 'ID của video được like/dislike'
    },
    status: { 
        type: String, 
        enum: ['like', 'dislike'], 
        required: true,
        description: 'Trạng thái: like hoặc dislike'
    },
}, { timestamps: true });

// Index để đảm bảo 1 user chỉ like/dislike 1 video 1 lần
likeSchema.index({ userId: 1, videoId: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);