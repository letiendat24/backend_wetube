const mongoose = require("mongoose");

const Video = require("../models/Video.model");
const Subscription = require("../models/Subscription.model"); 
const History = require("../models/History.model");
const Like = require("../models/Like.model");
const User = require("../models/User.model");

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

const getByTag = async (req, res, next) => {
  try {
    // 1. Xử lý Tags đầu vào: Nếu rỗng hoặc undefined thì gán mảng rỗng
    const tagsStr = req.query.tags || "";
    const tags = tagsStr.split(",").filter(tag => tag.trim() !== ""); 
    
    const LIMIT = 20;
    let videos = [];

    // 2. BƯỚC 1: Chỉ tìm theo Tag nếu danh sách tag không rỗng
    if (tags.length > 0) {
        videos = await Video.find({ 
            tags: { $in: tags },
            visibility: 'public' 
        })
        .limit(LIMIT)
        .populate("ownerId", "channelName avatarUrl");
    }

    // 3. BƯỚC 2: Logic "Lấp đầy" (Backfill)
    // Nếu video không có tag (videos.length == 0) -> Nó sẽ lấy full 20 video ngẫu nhiên
    // Nếu video có ít tag (videos.length == 5) -> Nó sẽ lấy thêm 15 video ngẫu nhiên
    if (videos.length < LIMIT) {
        const needed = LIMIT - videos.length;
        
        // Lấy danh sách ID đã có để trừ ra
        const existingIds = videos.map(v => v._id);

        const randomVideos = await Video.aggregate([
            { 
              $match: { 
                _id: { $nin: existingIds }, // Không lấy trùng
                visibility: 'public' 
              } 
            },
            { $sample: { size: needed } } // Lấy ngẫu nhiên
        ]);

        // Populate video ngẫu nhiên
        const populatedRandomVideos = await Video.populate(randomVideos, {
            path: "ownerId",
            select: "channelName avatarUrl"
        });

        videos = [...videos, ...populatedRandomVideos];
    }

    res.status(200).json(videos);
  } catch (err) {
    next(err);
  }
};

const getLikedVideos = async (req, res, next) => {
  const userId = req.userId;

  try {
    const likedVideos = await Like.aggregate([
      // 1. Lọc các record Like của user hiện tại với status='like'
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "like",
        },
      },

      // 2. Sắp xếp mới nhất
      { $sort: { createdAt: -1 } },

      // 3. Join với bảng Videos
      {
        $lookup: {
          from: "videos",
          localField: "videoId",
          foreignField: "_id",
          as: "videoDetails",
        },
      },
      { $unwind: "$videoDetails" },

      // 4. Join với bảng Users (để lấy tên kênh)
      {
        $lookup: {
          from: "users",
          localField: "videoDetails.ownerId",
          foreignField: "_id",
          as: "channelDetails",
        },
      },
      { $unwind: "$channelDetails" },

      // 5. Chọn các trường cần lấy
      {
        $project: {
          _id: "$videoDetails._id",
          title: "$videoDetails.title",
          description: "$videoDetails.description",
          thumbnailUrl: "$videoDetails.thumbnailUrl",
          views: "$videoDetails.stats.views",
          likedAt: "$createdAt",
          channelName: "$channelDetails.channelName",
          channelId: "$channelDetails._id",
          channelAvatar: "$channelDetails.img", // Lấy thêm avatar kênh cho đẹp
        },
      },
    ]);

    res.status(200).json(likedVideos);
  } catch (err) {
    next(err);
  }
};

const handleInteraction = async (videoId, userId, newStatus) => {
  const existingInter = await Like.findOne({ videoId, userId });

  if (existingInter) {
    if (existingInter.status === newStatus) {
       return { success: true, message: "Already set" };
    }
    // Update Stats: Đổi trạng thái (VD: Like -> Dislike)
    if (newStatus === 'like') {
        await Video.findByIdAndUpdate(videoId, { $inc: { "stats.likes": 1, "stats.dislikes": -1 } });
    } else {
        await Video.findByIdAndUpdate(videoId, { $inc: { "stats.likes": -1, "stats.dislikes": 1 } });
    }
    existingInter.status = newStatus;
    await existingInter.save();
  } else {
    // Tạo mới
    const fieldToInc = newStatus === 'like' ? "stats.likes" : "stats.dislikes";
    await Video.findByIdAndUpdate(videoId, { $inc: { [fieldToInc]: 1 } });
    await Like.create({ videoId, userId, status: newStatus });
  }
  return { success: true };
};

// 1. Kiểm tra trạng thái User với Video (Like/Dislike/Sub)
const getAuthStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const videoId = req.params.videoId;

    const interaction = await Like.findOne({ userId, videoId });
    
    // Check Subscribe
    const video = await Video.findById(videoId);
    let isSubscribed = false;
    if (video) {
        const user = await User.findById(userId);
        if (user && user.subscribedUsers.includes(video.ownerId)) {
            isSubscribed = true;
        }
    }

    res.status(200).json({
        status: interaction ? interaction.status : "none", // 'like', 'dislike', 'none'
        isSubscribed
    });
  } catch (err) {
    next(err);
  }
};

// 2. Like Video
const likeVideo = async (req, res, next) => {
  try {
    await handleInteraction(req.params.videoId, req.userId, "like");
    res.status(200).json({ message: "Liked successfully" });
  } catch (err) {
    next(err);
  }
};

// 3. Dislike Video
const dislikeVideo = async (req, res, next) => {
  try {
    await handleInteraction(req.params.videoId, req.userId, "dislike");
    res.status(200).json({ message: "Disliked successfully" });
  } catch (err) {
    next(err);
  }
};

// 4. Hủy Like/Dislike (Delete)
const removeInteraction = async (req, res, next) => {
  try {
    const deleted = await Like.findOneAndDelete({ 
        videoId: req.params.videoId, 
        userId: req.userId 
    });

    if (deleted) {
        const fieldToDec = deleted.status === "like" ? "stats.likes" : "stats.dislikes";
        await Video.findByIdAndUpdate(req.params.videoId, { $inc: { [fieldToDec]: -1 } });
    }
    res.status(200).json({ message: "Removed interaction" });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  sub, 
  trend, 
  getHistory, 
  addToHistory, 
  getByTag, 
  getLikedVideos,
  getAuthStatus,
  likeVideo,
  dislikeVideo,
  removeInteraction
 };

