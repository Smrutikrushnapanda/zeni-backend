const express = require("express");
const router = express.Router();
const axios = require("axios");
const adminAuth = require("../middlewares/adminAuth");

const {
  addNotificationsForUsers,
  getDeviceTokensForUsers,
  getAllDeviceTokens,
  getAllUserIds,
} = require("../stores/notifications.store");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const sendPushNotifications = async ({ tokens, title, body, data }) => {
  if (!tokens.length) {
    return { success: true, sent: 0, failed: 0 };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: data || {},
  }));

  try {
    const response = await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
    });

    const results = response.data?.data || [];
    const sent = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;

    if (failed > 0) {
      const errors = results.filter((r) => r.status === "error");
      console.log("Push errors:", errors.map((e) => e.message));
    }

    return { success: true, sent, failed };
  } catch (error) {
    console.error("Expo Push Error:", error.message);
    return { success: false, reason: error.message, sent: 0 };
  }
};

const buildNotificationData = ({ id, title, body, targetAudience, channel, createdAt }) => ({
  id,
  title,
  body,
  targetAudience,
  channel,
  createdAt,
});

// WS broadcast helper
let broadcastInAppNotification = null;
const setBroadcastHelper = (fn) => { broadcastInAppNotification = fn; };

router.post("/send-notification", adminAuth, async (req, res) => {
  try {
    const { title, body, targetAudience, channel, userIds } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Title and body are required"
      });
    }

    const timestamp = new Date().toISOString();
    const notificationId = `${Date.now()}`;
    const targetUserIds = Array.isArray(userIds) && userIds.length ? userIds : null;

    const normalizedChannel = channel || "both";

    const notificationData = buildNotificationData({
      id: notificationId,
      title,
      body,
      targetAudience: targetAudience || "all",
      channel: normalizedChannel,
      createdAt: timestamp,
    });

    const created = addNotificationsForUsers(targetUserIds, notificationData);
    const allUserIds = targetUserIds || getAllUserIds();

    const sendFcm = !channel || channel === "mobile" || channel === "both";
    const sendInApp = !channel || channel === "in_app" || channel === "both";

    if (sendFcm) {
      console.log("Sending FCM Notification:", {
        title,
        body,
        targetAudience,
        timestamp
      });

      const tokens = targetUserIds?.length
        ? getDeviceTokensForUsers(targetUserIds)
        : getAllDeviceTokens();

      const pushResult = await sendPushNotifications({
        tokens,
        title,
        body,
        data: { notificationId: notificationId, channel: normalizedChannel, targetAudience: targetAudience || "all" },
      });

      if (!pushResult.success) {
        console.log("Push skipped:", pushResult.reason);
      }
    }

    const inAppPayload = {
      id: notificationId,
      title,
      body,
      targetAudience: targetAudience || "all",
      sentAt: timestamp
    };

    if (sendInApp) {
      if (broadcastInAppNotification) {
        broadcastInAppNotification(inAppPayload, allUserIds.length ? allUserIds : null);
      }
    }

    res.json({
      success: true,
      message: "Notification sent successfully",
      details: {
        title,
        body,
        targetAudience: targetAudience || "all",
        sentAt: timestamp,
        channels: {
          fcm: sendFcm,
          inApp: sendInApp
        },
        storedForUsers: created.length
      },
    });
  } catch (error) {
    console.error("Notification Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: error.message
    });
  }
});

router.post("/test-push", adminAuth, async (req, res) => {
  try {
    const { token, userId, title, body } = req.body;

    const resolvedTitle = title || "Test Push Notification";
    const resolvedBody = body || "If you see this, push is working.";

    let tokens = [];
    if (token) {
      tokens = [token];
    } else if (userId) {
      tokens = getDeviceTokensForUsers([userId]);
    } else {
      tokens = getAllDeviceTokens();
    }

    const result = await sendPushNotifications({
      tokens,
      title: resolvedTitle,
      body: resolvedBody,
      data: { notificationId: `test_${Date.now()}`, channel: "mobile", targetAudience: "test" },
    });

    res.json({
      success: true,
      message: "Test push request sent",
      details: {
        tokensTried: tokens.length,
        result,
      },
    });
  } catch (error) {
    console.error("Test Push Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test push",
      error: error.message,
    });
  }
});

module.exports = router;
module.exports.setBroadcastHelper = setBroadcastHelper;

