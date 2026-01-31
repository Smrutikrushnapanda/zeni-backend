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
router.post("/chats/:userId/chats", (req, res) => {
  const { userId } = req.params;
  const { id, title } = req.body;

  if (!id || !title) {
    return res.status(400).json({ 
      success: false,
      error: "id and title required" 
    });
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

  res.json({ 
    success: true, 
    data: chat 
  });
});

// ================= UPDATE CHAT =================
router.put("/chats/:userId/chats/:chatId", (req, res) => {
  const { userId, chatId } = req.params;
  const { title, messages } = req.body;

  if (!userChats[userId]) {
    return res.status(404).json({ 
      success: false,
      error: "User not found" 
    });
  }

  const chat = userChats[userId].chats.find(c => c.id === chatId);
  if (!chat) {
    return res.status(404).json({ 
      success: false,
      error: "Chat not found" 
    });
  }

  if (title !== undefined) chat.title = title;
  if (messages !== undefined) chat.messages = messages;
  chat.updatedAt = new Date().toISOString();

  res.json({ 
    success: true, 
    data: chat 
  });
});

// ================= SET ACTIVE CHAT =================
router.put("/chats/:userId/active-chat", (req, res) => {
  const { userId } = req.params;
  const { chatId } = req.body;

  if (!userChats[userId]) {
    userChats[userId] = { chats: [], activeChat: null };
  }

  userChats[userId].activeChat = chatId;
  res.json({ success: true });
});

// ================= DELETE SINGLE CHAT =================
router.delete("/chats/:userId/chats/:chatId", (req, res) => {
  const { userId, chatId } = req.params;

  if (!userChats[userId]) {
    return res.status(404).json({ 
      success: false,
      error: "User not found" 
    });
  }

  const initialLength = userChats[userId].chats.length;
  userChats[userId].chats = userChats[userId].chats.filter(
    (c) => c.id !== chatId
  );

  if (userChats[userId].chats.length === initialLength) {
    return res.status(404).json({ 
      success: false,
      error: "Chat not found" 
    });
  }

  if (userChats[userId].activeChat === chatId) {
    userChats[userId].activeChat = userChats[userId].chats[0]?.id || null;
  }

  res.json({ success: true });
});

// ================= CLEAR ALL CHATS =================
router.delete("/chats/:userId/chats", (req, res) => {
  const { userId } = req.params;
  
  userChats[userId] = {
    chats: [],
    activeChat: null,
  };
  
  res.json({ success: true });
});

// ================= ADD MESSAGE =================
router.post("/chats/:userId/chats/:chatId/messages", (req, res) => {
  const { userId, chatId } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ 
      success: false,
      error: "Message is required" 
    });
  }

  if (!userChats[userId]) {
    return res.status(404).json({ 
      success: false,
      error: "User not found" 
    });
  }

  const chat = userChats[userId].chats.find((c) => c.id === chatId);

  if (!chat) {
    return res.status(404).json({ 
      success: false,
      error: "Chat not found" 
    });
  }

  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...message,
    timestamp: message.timestamp || new Date().toISOString(),
  };

  chat.messages.push(newMessage);
  chat.updatedAt = new Date().toISOString();

  res.json({ 
    success: true, 
    data: newMessage 
  });
});

module.exports = router;