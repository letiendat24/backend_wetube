require("dotenv").config(); // Load biến môi trường từ .env
const express = require("express");
const connectDB = require("./src/config/db.config");
const apiRoutes = require("./src/routes/index"); // Lấy router tổng
const cors = require("cors");
const { startHealthCheck } = require("../backend/src/utils/heathCheck");
const app = express();
const PORT = process.env.PORT || 3000;

//Cấu hình CORS (Cho phép Frontend gọi API)
app.use(
  cors({
    origin: "http://localhost:5173", // Chỉ cho phép Frontend ở cổng này gọi tới
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], // Các method cho phép
    credentials: true, // Cho phép gửi cookie/token nếu cần
  })
);

// Middleware cơ bản
app.use(express.json()); // Cho phép Express đọc JSON body
app.use(express.urlencoded({ extended: true })); // Cho phép Express đọc form data

// Kết nối Database
connectDB();

// Định nghĩa tuyến đường chính
app.use("/api", apiRoutes); // Tất cả API sẽ bắt đầu bằng /api

// Tuyến đường mặc định (Optional)
app.get("/", (req, res) => {
  res.send("Welcome to YouTube Clone API");
});

app.use((req, res, next) => {
  res.status(404).json({ message: "Không tìm thấy API endpoint." });
});

// Xử lý lỗi tổng quát
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Lỗi Server Nội bộ.",
  });
});
//Check status commentService
startHealthCheck();
// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
