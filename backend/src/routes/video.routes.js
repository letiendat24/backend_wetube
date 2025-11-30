const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middlewares/auth.middleware");
const { cloudinaryUploadMiddleware } = require('../helpers/upload.helper');

// Models cần thiết
const Video = require("../models/Video.model");
const Like = require("../models/Like.model");
const History = require("../models/History.model");

const router = express.Router();

// HELPER FUNCTION: Xử lý Logic Like/Dislike (Dùng Transaction)

const updateLikeDislike = async (videoId, userId, newStatus) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let videoUpdate = {};
    let statusChanged = false;

    const existingLike = await Like.findOne({ videoId, userId }).session(session);

    if (existingLike) {
      const oldStatus = existingLike.status;
Ư
      if (oldStatus === newStatus) {
        await session.abortTransaction();
        return { success: true, message: `Video đã được ${newStatus}` };
      }

      if (oldStatus === "like") {
        videoUpdate = { $inc: { "stats.likes": -1, "stats.dislikes": 1 } };
      } else {
        videoUpdate = { $inc: { "stats.likes": 1, "stats.dislikes": -1 } };
      }
      statusChanged = true;

      await Like.updateOne(
        { _id: existingLike._id },
        { status: newStatus },
        { session }
      );
    } else {
      videoUpdate = { $inc: { [`stats.${newStatus}`]: 1 } };
      statusChanged = true;
      await Like.create([{ videoId, userId, status: newStatus }], { session });
    }

    if (statusChanged) {
      await Video.findByIdAndUpdate(videoId, videoUpdate, { session });
    }

    await session.commitTransaction();
    return { success: true, message: `Đã ${newStatus} video.` };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};


// VIDEO CRUD ENDPOINTS(create video)
// 1. CREATE: POST /api/videos (Upload Video Metadata)

// router.post("/", authMiddleware, async (req, res) => {
//   try {
//     const { title, description, tags, visibility, videoUrl, thumbnailUrl } = req.body;

//     if (!title || !videoUrl || !thumbnailUrl) {
//       return res
//         .status(400)
//         .json({ message: "Tiêu đề, URL video và URL thumbnail là bắt buộc." });
//     }

//     const newVideo = await Video.create({
//       ownerId: req.userId,
//       title,
//       description,
//       tags: tags || [],
//       visibility: visibility || "public",
//       videoUrl,
//       thumbnailUrl,
//     });

//     res.status(201).json(newVideo);
//   } catch (error) {
//     console.error("Lỗi POST /videos:", error);
//     res.status(500).json({ message: "Tạo video thất bại." });
//   }
// });
router.post("/", authMiddleware, cloudinaryUploadMiddleware, async (req, res) => {
    try {
        // req.videoUrl và req.thumbnailUrl đã có sẵn từ middleware
        const { videoUrl, thumbnailUrl } = req; 
        const { title, description, tags, visibility } = req.body;
        
        if (!title) {
            return res.status(400).json({ message: "Tiêu đề là bắt buộc." });
        }

        const newVideo = await Video.create({
            ownerId: req.userId,
            title,
            description,
            // Cần parse tags nếu nó là một chuỗi JSON từ form-data
            tags: tags ? JSON.parse(tags) : [], 
            visibility: visibility || "public",
            videoUrl, // <-- URL Cloudinary
            thumbnailUrl, // <-- URL Cloudinary
        });

        res.status(201).json(newVideo);
    } catch (error) {
        console.error("Lỗi POST /videos:", error);
        res.status(500).json({ message: "Tạo video thất bại." });
    }
});

// GET /api/videos/studio (Lấy TOÀN BỘ video của người dùng hiện tại)
router.get('/studio', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const videos = await Video.find({ ownerId: userId })
            .sort({ createdAt: -1 }) // Mới nhất lên đầu
            .populate('ownerId', 'channelName avatarUrl'); 

        res.json(videos);
    } catch (error) {
        console.error("Lỗi GET /videos/studio:", error);
        res.status(500).json({ message: "Lỗi lấy danh sách video studio." });
    }
});

// LISTING, SEARCH, LIKES ENDPOINTS
// 5. LISTING & SEARCH: GET /api/videos (Trang chủ/Tìm kiếm)
router.get("/", async (req, res) => {
  try {
    const { search, tag, sort, channelId, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pipeline = [];
    const matchStage = { visibility: "public" }; 

    if (channelId) {
      matchStage.ownerId = new mongoose.Types.ObjectId(channelId);
    }
    if (tag) {
      matchStage.tags = tag;
    }

    if (search) {
      pipeline.push({ $match: { $text: { $search: search } } });
      pipeline.push({ $addFields: { score: { $meta: "textScore" } } });
    }

    pipeline.push({ $match: matchStage });

    const sortStage = {};
    if (sort === "popular") {
      sortStage["stats.views"] = -1;
    } else if (search) {
      sortStage.score = -1;
    } else {
      sortStage.createdAt = -1;
    }
    pipeline.push({ $sort: sortStage });

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    pipeline.push({
      $lookup: {
        from: "users",
        localField: "ownerId",
        foreignField: "_id",
        as: "channelInfo",
      },
    });
    pipeline.push({ $unwind: "$channelInfo" });

    pipeline.push({
      $project: {
        "channelInfo.passwordHash": 0,
        "channelInfo.email": 0,
        "channelInfo.subscribersCount": 0,
      },
    });

    const videos = await Video.aggregate(pipeline);

    res.json(videos);
  } catch (error) {
    console.error("Lỗi GET /videos (Listing/Search):", error);
    res.status(500).json({ message: "Lỗi tìm kiếm và danh sách video." });
  }
});

//GET /api/videos/liked (Lấy danh sách video đã được user like)
router.get('/liked', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
        const likedVideos = await Like.aggregate([
            // 1. $match: Lọc các record Like của user hiện tại với status='like'
            { $match: { 
                userId: new mongoose.Types.ObjectId(userId),
                status: 'like'
            }},
            
            // 2. $sort: Sắp xếp theo thời gian like gần nhất
            { $sort: { createdAt: -1 } },

            // 3. $lookup: Lấy thông tin chi tiết Video
            { $lookup: {
                from: 'videos',
                localField: 'videoId',
                foreignField: '_id',
                as: 'videoDetails'
            }},
            { $unwind: '$videoDetails' },
            
            // 4. $lookup: Lấy thông tin Channel (owner) của video
            { $lookup: {
                from: 'users',
                localField: 'videoDetails.ownerId',
                foreignField: '_id',
                as: 'channelDetails'
            }},
            { $unwind: '$channelDetails' },

            // 5. $project: Định dạng lại output
            { $project: {
                _id: '$videoDetails._id',
                title: '$videoDetails.title',
                description: '$videoDetails.description',
                thumbnailUrl: '$videoDetails.thumbnailUrl',
                views: '$videoDetails.stats.views',
                likedAt: '$createdAt', // Thời điểm user like
                channelName: '$channelDetails.channelName',
                channelId: '$channelDetails._id',
            }}
        ]);

        res.json(likedVideos);
    } catch (error) {
        console.error('Lỗi GET /videos/liked:', error);
        res.status(500).json({ message: 'Lấy danh sách video đã thích thất bại.' });
    }
});


// 2. READ: GET /api/videos/:videoId (Lấy thông tin và Tăng View)
router.get("/:videoId", async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.videoId,
      { $inc: { "stats.views": 1 } },
      { new: true }
    ).populate("ownerId", "channelName avatarUrl subscribersCount");

    if (!video) {
      return res.status(404).json({ message: "Video không tồn tại." });
    }

    // Tạm thời chỉ cho phép lấy video public
    if (video.visibility !== "public") {
      // Logic nâng cao hơn cần kiểm tra nếu user đang đăng nhập là owner
      return res
        .status(403)
        .json({ message: "Video không công khai hoặc bạn không có quyền truy cập." });
    }

    res.json(video);
  } catch (error) {
    console.error("Lỗi GET /videos/:videoId:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông tin video." });
  }
});


// 3. UPDATE: PATCH /api/videos/:videoId (Chỉnh sửa Video)
router.patch("/:videoId", authMiddleware, async (req, res) => {
  const { videoId } = req.params;
  const { title, description, tags, visibility } = req.body;

  const updates = {};
  if (title) updates.title = title;
  if (description) updates.description = description;
  if (tags) updates.tags = tags;
  if (visibility) updates.visibility = visibility;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "Không có dữ liệu cập nhật." });
  }

  try {
    const updatedVideo = await Video.findOneAndUpdate(
      { _id: videoId, ownerId: req.userId }, // Yêu cầu khớp cả ID video và ID người sở hữu
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedVideo) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy video hoặc bạn không có quyền chỉnh sửa." });
    }

    res.json(updatedVideo);
  } catch (error) {
    console.error("Lỗi PATCH /videos/:videoId:", error);
    res.status(500).json({ message: "Cập nhật video thất bại." });
  }
});

//LIKE/DISLIKE ENDPOINTS
// POST /api/videos/:id/like
router.post("/:videoId/like", authMiddleware, async (req, res) => {
  try {
    const result = await updateLikeDislike(
      req.params.videoId,
      req.userId,
      "like"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Thao tác Like thất bại." });
  }
});

//DELETE: DELETE /api/videos/:videoId (Xóa Video và Dữ liệu liên quan)
router.delete("/:videoId", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const videoId = req.params.videoId;

    // 1. Tìm và xóa Video chính (chỉ chủ sở hữu được xóa)
    const videoToDelete = await Video.findOneAndDelete(
      { _id: videoId, ownerId: req.userId },
      { session }
    );

    if (!videoToDelete) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Không tìm thấy video hoặc bạn không có quyền xóa." });
    }

    // 2. Xóa các record liên quan (Likes, History)
    await Like.deleteMany({ videoId }, { session });
    await History.deleteMany({ videoId }, { session });
    // TODO: THÊM LOGIC XÓA FILE VẬT LÝ TRÊN CLOUDINARY/S3

    await session.commitTransaction();
    res
      .status(200)
      .json({ message: "Video và các dữ liệu liên quan đã được xóa thành công." });
  } catch (error) {
    await session.abortTransaction();
    console.error("Lỗi DELETE /videos/:videoId:", error);
    res.status(500).json({ message: "Xóa video thất bại." });
  } finally {
    session.endSession();
  }
});

// POST /api/videos/:id/dislike
router.post("/:videoId/dislike", authMiddleware, async (req, res) => {
  try {
    const result = await updateLikeDislike(
      req.params.videoId,
      req.userId,
      "dislike"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Thao tác Dislike thất bại." });
  }
});

// DELETE /api/videos/:id/like (Hủy Like hoặc Dislike)
router.delete("/:videoId/like", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deletedLike = await Like.findOneAndDelete({
      videoId: req.params.videoId,
      userId: req.userId,
    }).session(session);

    if (!deletedLike) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Bạn chưa Like hoặc Dislike video này." });
    }

    const statusToDecrement =
      deletedLike.status === "like" ? "stats.likes" : "stats.dislikes";

    await Video.findByIdAndUpdate(
      req.params.videoId,
      { $inc: { [statusToDecrement]: -1 } },
      { session }
    );

    await session.commitTransaction();
    res.json({ message: `Đã hủy ${deletedLike.status} thành công.` });
  } catch (error) {
    await session.abortTransaction();
    console.error("Lỗi Hủy Like/Dislike:", error);
    res.status(500).json({ message: "Thao tác hủy thất bại." });
  } finally {
    session.endSession();
  }
});


// 7. GET /api/videos/liked (Lấy danh sách video đã được user like)
router.get('/liked', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
        const likedVideos = await Like.aggregate([
            { $match: { 
                userId: new mongoose.Types.ObjectId(userId),
                status: 'like'
            }},
            
            { $sort: { createdAt: -1 } },

            { $lookup: {
                from: 'videos',
                localField: 'videoId',
                foreignField: '_id',
                as: 'videoDetails'
            }},
            { $unwind: '$videoDetails' },
            
            { $lookup: {
                from: 'users',
                localField: 'videoDetails.ownerId',
                foreignField: '_id',
                as: 'channelDetails'
            }},
            { $unwind: '$channelDetails' },

            { $project: {
                _id: '$videoDetails._id',
                title: '$videoDetails.title',
                thumbnailUrl: '$videoDetails.thumbnailUrl',
                views: '$videoDetails.stats.views',
                likedAt: '$createdAt', 
                channelName: '$channelDetails.channelName',
                channelId: '$channelDetails._id',
            }}
        ]);

        res.json(likedVideos);
    } catch (error) {
        console.error('Lỗi GET /videos/liked:', error);
        res.status(500).json({ message: 'Lấy danh sách video đã thích thất bại.' });
    }
});


module.exports = router;