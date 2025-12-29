require("dotenv").config();
const express = require("express");
const cors = require("cors");
const askGroq = require("./groq");

const app = express();

// ========================================
// MIDDLEWARE
// ========================================

// CORS - Allow React Native to connect
app.use(cors({
  origin: '*',  // Allow all origins (fine for development)
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

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
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
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
    activeConversations: conversations.size
  });
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log(`💬 Message from ${sessionId}: ${message.substring(0, 50)}...`);

    // Get AI response
    const reply = await askGroq(message);

    console.log(`✅ Reply sent (${reply.length} chars)`);

    res.json({ 
      reply,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ GROQ ERROR:", error.response?.data || error.message);

    res.status(500).json({
      error: "AI error",
      message: error.response?.data?.error?.message || error.message
    });
  }
});

// Clear conversation (optional)
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
// ERROR HANDLING
// ========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Endpoint not found",
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n🚀 Zeni AI Backend');
  console.log('━'.repeat(50));
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🤖 Groq API: ${process.env.GROQ_API_KEY ? 'Connected ✅' : 'Missing ❌'}`);
  console.log(`🌐 CORS: Enabled (all origins)`);
  console.log('━'.repeat(50));
  console.log('\n📚 Endpoints:');
  console.log('  GET  /                    - Health check');
  console.log('  POST /chat                - Send message');
  console.log('  DEL  /conversation/:id    - Clear conversation');
  console.log('\n✅ Ready to receive requests!\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});