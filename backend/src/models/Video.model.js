// src/models/Video.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const videoSchema = new mongoose.Schema({
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    tags: [{ type: String }],
    visibility: { type: String, enum: ['public', 'private', 'unlisted'], default: 'public' },

    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },

    stats: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        dislikes: { type: Number, default: 0 },
    },
}, { timestamps: true });

// Index cho tìm kiếm và trang kênh
videoSchema.index({ ownerId: 1, createdAt: -1 });
videoSchema.index({ title: 'text', description: 'text', tags: 'text' }); // Text Index cho Search

module.exports = mongoose.model('Video', videoSchema);