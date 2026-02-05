const express = require("express");
const router = express.Router();
const adminAuth = require("../middlewares/adminAuth");

const {
  addNotificationsForUsers,
  getDeviceTokensForUsers,
  getAllDeviceTokens,
  getAllUserIds,
} = require("../stores/notifications.store");

const sendPushNotifications = async ({ tokens, notification, data }) => {
  const admin = require("firebase-admin");

  if (!tokens.length) {
    return { success: true, sent: 0 };
  }

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data,
    });

    return {
      success: true,
      sent: response.successCount || 0,
      failed: response.failureCount || 0,
    };
  } catch (error) {
    console.error("FCM Error:", error.message);
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

const buildFcmDataPayload = (notification) => ({
  notificationId: notification.id,
  channel: notification.channel || "mobile",
  targetAudience: notification.targetAudience || "all",
});

const buildFcmNotification = (notification) => ({
  title: notification.title,
  body: notification.body,
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

    if (!channel || channel === "mobile") {
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
        notification: buildFcmNotification(notificationData),
        data: buildFcmDataPayload(notificationData),
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

    if (!channel || channel === "in_app") {
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
          fcm: !channel || channel === "mobile",
          inApp: !channel || channel === "in_app"
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

    const testNotification = {
      id: `test_${Date.now()}`,
      title: resolvedTitle,
      body: resolvedBody,
      channel: "mobile",
      targetAudience: "test",
      createdAt: new Date().toISOString(),
    };

    const result = await sendPushNotifications({
      tokens,
      notification: buildFcmNotification(testNotification),
      data: buildFcmDataPayload(testNotification),
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

