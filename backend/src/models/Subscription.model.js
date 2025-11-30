// src/models/Subscription.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const subscriptionSchema = new mongoose.Schema({
    subscriberId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        description: 'ID của người đăng ký'
    },
    channelId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        description: 'ID của kênh được đăng ký'
    },
}, { timestamps: true });

// Index để đảm bảo 1 người chỉ đăng ký 1 kênh 1 lần
subscriptionSchema.index({ subscriberId: 1, channelId: 1 }, { unique: true });
// Index cho trang sidebar (danh sách kênh mà user đang subscribe)
subscriptionSchema.index({ subscriberId: 1, createdAt: -1 });
// Index cho trang kênh (danh sách subscriber)
subscriptionSchema.index({ channelId: 1, createdAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);