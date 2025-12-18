const Video = require("../models/Video.model");
const Subscription = require("../models/Subscription.model"); 
const History = require("../models/History.model");
const sub = async (req, res, next) => {
  try {
    // 1. Tìm trong bảng Subscription: Lấy tất cả các dòng mà subscriberId khớp với người đang login
    const userSubscriptions = await Subscription.find({ 
        subscriberId: req.userId 
    });

    // 2. Lấy ra danh sách các channelId từ kết quả trên
    // Map qua mảng kết quả để lấy giá trị của trường 'channelId'
    const subscribedChannelIds = userSubscriptions.map(sub => sub.channelId);

    // 3. Tìm tất cả video mà tác giả (ownerId) nằm trong danh sách channelId vừa lấy
    const list = await Video.find({
      ownerId: { $in: subscribedChannelIds },
    })
    .sort({ createdAt: -1 }) // Sắp xếp video mới nhất lên đầu
    .populate("ownerId", "channelName avatarUrl"); // Lấy thông tin kênh để hiển thị card

    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
};

// 
const trend = async (req, res, next) => {
  try {
    // Tìm tất cả video, sắp xếp view cao nhất lên đầu
    // stats.views: -1 nghĩa là Descending (Giảm dần)
    const videos = await Video.find()
      .sort({ "stats.views": -1 }) 
      .populate("ownerId", "channelName avatarUrl") // Lấy info chủ kênh
      .limit(40); // Chỉ lấy top 40 video thôi cho nhẹ

    res.status(200).json(videos);
  } catch (err) {
    next(err);
  }
};
// History
const addToHistory = async (req, res, next) => {
  try {
    // Nếu user chưa đăng nhập thì bỏ qua
    if (!req.userId) return res.status(200).json({ message: "Guest user" });

    await History.findOneAndUpdate(
      { 
        userId: req.userId, 
        videoId: req.params.videoId // Lấy ID từ url
      },
      { 
        $set: { watchedAt: Date.now() } // Cập nhật thời gian xem mới nhất
      },
      { 
        upsert: true, // Chưa có thì tạo mới, có rồi thì update
        new: true 
      }
    );
    res.status(200).json({ message: "History updated" });
  } catch (err) {
    next(err);
  }
};

// --- HÀM 2: Lấy danh sách lịch sử ---
const getHistory = async (req, res, next) => {
  try {
    const histories = await History.find({ userId: req.userId })
      .sort({ watchedAt: -1 }) // Mới xem nhất lên đầu
      .populate({
        path: "videoId",
        populate: { path: "ownerId", select: "channelName avatarUrl" },
      });

    // Lọc bỏ video null (phòng trường hợp video gốc bị xóa)
    const videos = histories
      .map((h) => h.videoId)
      .filter((v) => v !== null);

    res.status(200).json(videos);
  } catch (err) {
    next(err);
  }
};
module.exports = { sub, trend, getHistory, addToHistory };