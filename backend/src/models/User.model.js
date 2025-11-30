// src/models/User.model.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    username: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: 'default_avatar.png' },

    isChannel: { type: Boolean, default: true },
    channelName: { type: String, required: true, unique: true, trim: true },
    channelDescription: { type: String, default: '' },
    subscribersCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// Index cho tìm kiếm kênh
userSchema.index({ channelName: 'text' });

// Tùy chỉnh JSON output: loại bỏ passwordHash
userSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id;
        delete returnedObject._id;
        delete returnedObject.__v;
        delete returnedObject.passwordHash; // Không trả về mật khẩu
    }
});

module.exports = mongoose.model('User', userSchema);