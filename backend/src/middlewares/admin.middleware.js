// src/middlewares/admin.middleware.js
const User = require('../models/User.model');

const adminMiddleware = async (req, res, next) => {
    try {
        // req.userId đã có từ authMiddleware chạy trước đó
        const user = await User.findById(req.userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Truy cập bị từ chối. Bạn không phải là Admin.' });
        }

        next(); // Là Admin -> Cho qua
    } catch (error) {
        res.status(500).json({ message: 'Lỗi xác thực quyền Admin.' });
    }
};

module.exports = adminMiddleware;