const express = require("express");
const router = express.Router();

const {
  registerDevice,
  getNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
} = require("../stores/notifications.store");

router.post("/api/notifications/register-device", (req, res) => {
  const { userId, token, platform } = req.body;

  if (!userId || !token) {
    return res.status(400).json({
      success: false,
      message: "userId and token are required",
    });
  }

  const devices = registerDevice({ userId, token, platform });

  return res.json({
    success: true,
    message: "Device registered",
    devices,
  });
});

router.get("/api/notifications/:userId", (req, res) => {
  const { userId } = req.params;
  const unreadOnly = req.query.unreadOnly === "true";
  const limit = req.query.limit ? Number(req.query.limit) : 50;

  const notifications = getNotifications(userId, { unreadOnly, limit });

  return res.json({
    success: true,
    data: notifications,
  });
});

router.get("/api/notifications/:userId/unread-count", (req, res) => {
  const { userId } = req.params;
  const count = getUnreadCount(userId);

  return res.json({
    success: true,
    count,
  });
});

router.patch("/api/notifications/:userId/read-all", (req, res) => {
  const { userId } = req.params;
  const updated = markAllRead(userId);

  return res.json({
    success: true,
    updated,
  });
});

router.patch("/api/notifications/:userId/:notificationId/read", (req, res) => {
  const { userId, notificationId } = req.params;
  const notification = markRead(userId, notificationId);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found",
    });
  }

  return res.json({
    success: true,
    data: notification,
  });
});

module.exports = router;
