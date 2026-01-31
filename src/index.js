require("dotenv").config();
const express = require("express");
const cors = require("cors");
const askGroq = require("./groq");
const chatsRoutes = require("./routes/chats");
const sttRoutes = require("./routes/stt.routes");

const app = express();

// ========================================
// MIDDLEWARE
// ========================================

// CORS - Allow React Native to connect
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

// Body parser
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ========================================
// CONVERSATION MEMORY (OPTIONAL)
// ========================================

const conversations = new Map();

// Clean up old conversations (1 hour)
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
    activeConversations: conversations.size,
  });
});

// ========================================
// CHAT (AI)
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

// ========================================
// CHAT STORAGE ROUTES
// ========================================
app.use("/", chatsRoutes);

// ========================================
// SPEECH TO TEXT ROUTE
// ========================================
app.use("/api/stt", sttRoutes);

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("\n🚀 Zeni AI Backend");
  console.log("━".repeat(50));
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log("🌐 CORS: Enabled");
  console.log("━".repeat(50));
  console.log("\n📚 Available Endpoints:");
  console.log("\n  🏥 HEALTH:");
  console.log("    GET    /");
  console.log("\n  🤖 AI CHAT:");
  console.log("    POST   /chat");
  console.log("    GET    /conversation/:sessionId");
  console.log("    DELETE /conversation/:sessionId");
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

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n⚠️  SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n⚠️  SIGINT received, shutting down gracefully...");
  process.exit(0);
});

module.exports = app;
