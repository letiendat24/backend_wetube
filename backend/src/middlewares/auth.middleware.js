// src/middlewares/auth.middleware.js
// Chúng ta cần nhập hàm verifyToken từ file tiện ích
const { verifyToken } = require('../utils/jwt.utils'); 

const authMiddleware = (req, res, next) => {
    // 1. Lấy header Authorization
    const authHeader = req.headers.authorization;

    // Kiểm tra xem header có tồn tại và bắt đầu bằng 'Bearer ' không
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Nếu không có token, từ chối truy cập
        return res.status(401).json({ message: 'Truy cập bị từ chối. Vui lòng đăng nhập.' });
    }

    // Lấy chuỗi token (bỏ phần 'Bearer ')
    const token = authHeader.split(' ')[1];

    // 2. Xác thực token
    const decoded = verifyToken(token); 

    if (!decoded) {
        // Nếu token không hợp lệ (sai secret, hết hạn), từ chối truy cập
        return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
    }

    // 3. Gắn userId vào đối tượng request để các controller có thể sử dụng
    req.userId = decoded.userId;

    // Chuyển sang middleware hoặc controller tiếp theo
    next(); 
};

// Xuất (export) hàm middleware để các routes có thể sử dụng
module.exports = authMiddleware;