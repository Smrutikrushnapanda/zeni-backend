require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const http = require("http");
const { WebSocketServer } = require("ws");
const admin = require("firebase-admin");

// Initialize app
const app = express();

const askGroq = require("./groq");
const chatsRoutes = require("./routes/chats");
const sttRoutes = require("./routes/stt.routes");
const adminAuthRoutes = require("./routes/adminAuth.routes");
const adminNotificationsRoutes = require("./routes/adminNotifications.routes");
const notificationsRoutes = require("./routes/notifications.routes");

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parser
app.use(express.json());

// URL-encoded body parser
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const conversations = new Map();

const parseFirebaseCredentials = () => {
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch (decodeError) {
      console.error("❌ Failed to parse FIREBASE_ADMIN_KEY");
      return null;
    }
  }
};

let firebaseReady = false;
const firebaseCredentials = parseFirebaseCredentials();
if (firebaseCredentials && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseCredentials),
  });
  firebaseReady = true;
}

// Clean up old conversations (every 15 minutes)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, data] of conversations.entries()) {
    if (data.lastActivity < oneHourAgo) {
      conversations.delete(sessionId);
      console.log(`🧹 Cleaned up conversation: ${sessionId}`);
    }
  }
}, 15 * 60 * 1000);

app.get("/", (req, res) => {
  res.json({
    status: "🚀 Zeni Backend running",
    timestamp: new Date().toISOString(),
    groqConnected: !!process.env.GROQ_API_KEY,
    resendConnected: !!process.env.RESEND_API_KEY,
    firebaseConnected: firebaseReady,
    activeConversations: conversations.size,
    websocket: {
      notifications: "/ws/notifications"
    },
    endpoints: {
      health: "GET /",
      chat: "POST /chat",
      conversations: "GET/DELETE /conversation/:sessionId",
      adminAuth: {
        sendOtp: "POST /api/admin/send-otp",
        verifyOtp: "POST /api/admin/verify-otp"
      },
      notifications: {
        sendNotification: "POST /api/admin/send-notification",
        testPush: "POST /api/admin/test-push",
        registerDevice: "POST /api/notifications/register-device",
        list: "GET /api/notifications/:userId",
        unreadCount: "GET /api/notifications/:userId/unread-count",
        markRead: "PATCH /api/notifications/:userId/:notificationId/read",
        markAllRead: "PATCH /api/notifications/:userId/read-all",
        inAppSocket: "WS /ws/notifications"
      },
      chatStorage: "Use /chats routes",
      stt: "POST /api/stt"
    }
  });
});

// ========================================
// AI CHAT ROUTES
// ========================================

app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const reply = await askGroq(message);

    res.json({
      reply,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({
      error: "AI error",
      message: error.message,
    });
  }
});

// Get conversation
app.get("/conversation/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  if (conversations.has(sessionId)) {
    res.json({
      sessionId,
      conversation: conversations.get(sessionId),
    });
  } else {
    res.status(404).json({ error: "Conversation not found" });
  }
});

// Clear conversation
app.delete("/conversation/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  if (conversations.has(sessionId)) {
    conversations.delete(sessionId);
    res.json({ message: "Conversation cleared", sessionId });
  } else {
    res.status(404).json({ error: "Conversation not found" });
  }
});

// ========================================
// ADMIN AUTH ROUTES (OTP Verification)
// ========================================

app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", adminNotificationsRoutes);

// Temporary test route - remove after debugging
app.get("/api/test", (req, res) => {
  res.json({ message: "Test route working" });
});

// ========================================
// NOTIFICATION ROUTES (public)
// ========================================

app.use("/", notificationsRoutes);

// ========================================
// CHAT STORAGE ROUTES
// ========================================

app.use("/", chatsRoutes);

// ========================================
// SPEECH TO TEXT ROUTE
// ========================================

app.use("/api/stt", sttRoutes);

// ========================================
// WEBSOCKET BROADCAST SETUP
// ========================================

const wsClients = new Map();
let wsClientId = 0;

const broadcastInAppNotification = (payload, targetUserIds) => {
  const message = JSON.stringify({
    type: "notification",
    payload,
  });

  for (const [id, client] of wsClients.entries()) {
    if (client.ws.readyState !== 1) {
      wsClients.delete(id);
      continue;
    }

    if (targetUserIds?.length && !targetUserIds.includes(client.userId)) {
      continue;
    }

    client.ws.send(message);
  }
};

// Wire up the broadcast helper to the notification routes
const { setBroadcastHelper } = require("./routes/adminNotifications.routes");
setBroadcastHelper(broadcastInAppNotification);

// ========================================
// SWAGGER DOCUMENTATION
// ========================================

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
  `,
  customSiteTitle: "Zeni AI API Docs"
}));

// Swagger JSON endpoint
app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler - MUST be after all routes
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: [
      "GET /",
      "POST /chat",
      "GET /conversation/:sessionId",
      "DELETE /conversation/:sessionId",
      "POST /api/admin/send-otp",
      "POST /api/admin/verify-otp",
      "POST /api/admin/send-notification",
      "POST /api/admin/test-push",
      "POST /api/notifications/register-device",
      "GET /api/notifications/:userId",
      "GET /api/notifications/:userId/unread-count",
      "PATCH /api/notifications/:userId/read-all",
      "PATCH /api/notifications/:userId/:notificationId/read",
      "POST /api/stt"
    ]
  });
});

// Global error handler - MUST be last middleware
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ========================================
// SERVER START
// ========================================

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/notifications" });

wss.on("connection", (ws, req) => {
  const clientId = `${Date.now()}-${++wsClientId}`;
  let userId = null;

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    userId = url.searchParams.get("userId");
  } catch (error) {
    userId = null;
  }

  wsClients.set(clientId, { ws, userId });

  console.log(`🔔 In-app client connected (${clientId}) from ${req.socket.remoteAddress}`);

  ws.send(JSON.stringify({
    type: "welcome",
    payload: {
      clientId,
      userId,
      message: "Connected to in-app notifications"
    }
  }));

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "register" && message.userId) {
        const client = wsClients.get(clientId);
        if (client) {
          client.userId = message.userId;
          wsClients.set(clientId, client);
        }
      }
    } catch (error) {
      // Ignore invalid messages
    }
  });

  ws.on("close", () => {
    wsClients.delete(clientId);
    console.log(`🔕 In-app client disconnected (${clientId})`);
  });

  ws.on("error", (err) => {
    wsClients.delete(clientId);
    console.error(`❌ WebSocket error (${clientId}):`, err.message);
  });
});

// Only start server if this file is run directly
if (require.main === module) {
  server.listen(PORT, () => {
    console.log("\n🚀 Zeni AI Backend");
    console.log("━".repeat(50));
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🔔 WebSocket: ws://localhost:${PORT}/ws/notifications`);
    console.log(`🌐 CORS: Enabled`);
    console.log(`🔑 JWT Expiry: ${process.env.JWT_EXPIRES_IN || '24h'}`);
    console.log(`📧 Resend: ${process.env.RESEND_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log("━".repeat(50));
    console.log("\n📚 Available Endpoints:");
    console.log("\n  🏥 HEALTH:");
    console.log("    GET    /");
    console.log("\n  🤖 AI CHAT:");
    console.log("    POST   /chat");
    console.log("    GET    /conversation/:sessionId");
    console.log("    DELETE /conversation/:sessionId");
    console.log("\n  🔐 ADMIN AUTH:");
    console.log("    POST   /api/admin/send-otp");
    console.log("    POST   /api/admin/verify-otp");
    console.log("\n  🔔 NOTIFICATIONS:");
    console.log("    POST   /api/admin/send-notification");
    console.log("    POST   /api/admin/test-push");
    console.log("    POST   /api/notifications/register-device");
    console.log("    GET    /api/notifications/:userId");
    console.log("    GET    /api/notifications/:userId/unread-count");
    console.log("    PATCH  /api/notifications/:userId/read-all");
    console.log("    PATCH  /api/notifications/:userId/:notificationId/read");
    console.log("\n  💾 CHAT STORAGE:");
    console.log("    GET    /chats/:userId");
    console.log("    POST   /chats/:userId/chats");
    console.log("    PUT    /chats/:userId/chats/:chatId");
    console.log("    PUT    /chats/:userId/active-chat");
    console.log("    DELETE /chats/:userId/chats/:chatId");
    console.log("    DELETE /chats/:userId/chats");
    console.log("    POST   /chats/:userId/chats/:chatId/messages");
    console.log("\n  🎤 SPEECH TO TEXT:");
    console.log("    POST   /api/stt");
    console.log("\n✅ Ready to receive requests!\n");
  });
}

// Graceful shutdown handlers
process.on("SIGTERM", () => {
  console.log("\n⚠️  SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n⚠️  SIGINT received, shutting down gracefully...");
  process.exit(0);
});

// Export for testing
module.exports = app;
