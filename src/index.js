require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

// Initialize app
const app = express();

// ========================================
// IMPORTS & INITIALIZATION
// ========================================
const askGroq = require("./groq");
const chatsRoutes = require("./routes/chats");
const sttRoutes = require("./routes/stt.routes");
const adminAuthRoutes = require("./routes/adminAuth.routes");

// ========================================
// MIDDLEWARE
// ========================================

// CORS - Allow React Native/Web to connect
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

// ========================================
// CONVERSATION MEMORY (OPTIONAL)
// ========================================

const conversations = new Map();

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

// ========================================
// ROUTES
// ========================================

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "🚀 Zeni Backend running",
    timestamp: new Date().toISOString(),
    groqConnected: !!process.env.GROQ_API_KEY,
    resendConnected: !!process.env.RESEND_API_KEY,
    activeConversations: conversations.size,
    endpoints: {
      health: "GET /",
      chat: "POST /chat",
      conversations: "GET/DELETE /conversation/:sessionId",
      adminAuth: {
        sendOtp: "POST /api/admin/send-otp",
        verifyOtp: "POST /api/admin/verify-otp"
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

// ========================================
// CHAT STORAGE ROUTES
// ========================================

app.use("/", chatsRoutes);

// ========================================
// SPEECH TO TEXT ROUTE
// ========================================

app.use("/api/stt", sttRoutes);

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

// Only start server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log("\n🚀 Zeni AI Backend");
    console.log("━".repeat(50));
    console.log(`📡 Server: http://localhost:${PORT}`);
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

