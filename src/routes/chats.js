const express = require("express");
const router = express.Router();

// In-memory store (later replace with DB)
const userChats = {};

// ================= GET ALL CHATS =================
router.get("/chats/:userId", (req, res) => {
  const { userId } = req.params;

  if (!userChats[userId]) {
    userChats[userId] = {
      chats: [],
      activeChat: null,
    };
  }

  res.json({
    success: true,
    data: userChats[userId],
  });
});

// ================= CREATE CHAT =================
router.post("/chats/:userId", (req, res) => {
  const { userId } = req.params;
  const { id, title } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: "id and title required" });
  }

  if (!userChats[userId]) {
    userChats[userId] = { chats: [], activeChat: null };
  }

  const chat = {
    id,
    title,
    messages: [],
    createdAt: new Date().toISOString(),
  };

  userChats[userId].chats.push(chat);
  userChats[userId].activeChat = id;

  res.json({ success: true, data: chat });
});

// ================= SET ACTIVE CHAT =================
router.put("/chats/:userId/active", (req, res) => {
  const { userId } = req.params;
  const { chatId } = req.body;

  if (!userChats[userId]) {
    return res.status(404).json({ error: "User not found" });
  }

  userChats[userId].activeChat = chatId;
  res.json({ success: true });
});

// ================= DELETE CHAT =================
router.delete("/chats/:userId/:chatId", (req, res) => {
  const { userId, chatId } = req.params;

  if (!userChats[userId]) {
    return res.status(404).json({ error: "User not found" });
  }

  userChats[userId].chats = userChats[userId].chats.filter(
    (c) => c.id !== chatId
  );

  if (userChats[userId].activeChat === chatId) {
    userChats[userId].activeChat =
      userChats[userId].chats[0]?.id || null;
  }

  res.json({ success: true });
});

// ================= CLEAR ALL CHATS =================
router.delete("/chats/:userId", (req, res) => {
  userChats[req.params.userId] = {
    chats: [],
    activeChat: null,
  };
  res.json({ success: true });
});

// ================= ADD MESSAGE =================
router.post("/chats/:userId/:chatId/messages", (req, res) => {
  const { userId, chatId } = req.params;
  const message = req.body;

  const chat = userChats[userId]?.chats.find(
    (c) => c.id === chatId
  );

  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  chat.messages.push({
    id: `msg_${Date.now()}`,
    ...message,
  });

  res.json({ success: true });
});

module.exports = router;
