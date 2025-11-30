// src/utils/healthCheck.js
const axios = require('axios');

const SERVICES = {
    COMMENT: 'http://127.0.0.1:3001/health' // API health của service con
};

// Trạng thái lưu trong RAM
let serviceStatus = {
    COMMENT: false 
};

const checkServices = async () => {
    console.log('Đang kiểm tra kết nối tới các Service...'); // Log để biết nó có chạy
    
    try {
        // Set timeout ngắn (2 giây) để không phải chờ lâu nếu service chết
        await axios.get(SERVICES.COMMENT, { timeout: 2000 });
        
        if (!serviceStatus.COMMENT) {
            console.log('[INFO] Comment Service đã ONLINE trở lại!');
        }
        serviceStatus.COMMENT = true;

    } catch (error) {
        // Log lỗi ngay lập tức bất kể trạng thái trước đó là gì
        console.error('[ALERT] Không thể kết nối Comment Service (Nó đang TẮT hoặc Lỗi)');
        // console.error('Lỗi chi tiết:', error.message); // Bật nếu muốn xem chi tiết
        serviceStatus.COMMENT = false;
    }
};

// Hàm lấy trạng thái (để Gateway Route dùng)
const getServiceStatus = () => serviceStatus;

// Chạy định kỳ
const startHealthCheck = () => {
    checkServices(); // Chạy ngay lập tức lần đầu
    setInterval(checkServices, 30000); // Sau đó cứ 30s chạy 1 lần
};

module.exports = { startHealthCheck, getServiceStatus };