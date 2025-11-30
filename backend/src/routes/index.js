// src/routes/index.js
const express = require('express');
const router = express.Router();

// Tải các router module
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const videoRoutes = require('./video.routes');
const channelRoutes = require('./channel.routes'); 
const historyRoutes = require('./history.routes'); 
const statsRoutes = require('./stats.routes'); 
const gatewayRoutes = require('./gateway.routes');

// Sử dụng các router
router.use('/auth', authRoutes); // /api/auth
router.use('/users', userRoutes); // /api/users
router.use('/videos', videoRoutes); // /api/videos
router.use('/channels', channelRoutes); // /api/channels
router.use('/history', historyRoutes);
router.use('/stats', statsRoutes); 
router.use('/comments', gatewayRoutes); // Endpoint sẽ là /api/comments

module.exports = router;