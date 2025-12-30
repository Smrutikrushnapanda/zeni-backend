import express from "express";
const router = express.Router();

let chats = [];
let activeChat = null;

// GET sidebar chats
router.get("/", (req, res) => {
  res.json({ chats, activeChat });
});

// CREATE chat
router.post("/", (req, res) => {
  const { id, title } = req.body;
  const chat = {
    id,
    title,
    messages: [],
    createdAt: new Date().toISOString(),
  };
  chats.push(chat);
  activeChat = id;
  res.json(chat);
});

// DELETE chat
router.delete("/:id", (req, res) => {
  chats = chats.filter((c) => c.id !== req.params.id);
  if (activeChat === req.params.id) {
    activeChat = chats[0]?.id || null;
  }
  res.json({ success: true });
});

// SET active chat
router.post("/active", (req, res) => {
  activeChat = req.body.chatId;
  res.json({ success: true });
});

// ADD message
router.post("/:id/messages", (req, res) => {
  const chat = chats.find((c) => c.id === req.params.id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  chat.messages.push({
    id: `msg_${Date.now()}`,
    ...req.body,
  });

  res.json({ success: true });
});

// CLEAR all chats
router.delete("/", (req, res) => {
  chats = [];
  activeChat = null;
  res.json({ success: true });
});

export default router;
