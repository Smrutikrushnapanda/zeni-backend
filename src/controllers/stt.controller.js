const fs = require("fs");
const { sendToWhisper } = require("../utils/whisperClient");

exports.speechToText = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file required" });
    }

    const text = await sendToWhisper(req.file.path);

    // cleanup temp file
    fs.unlinkSync(req.file.path);

    res.json({ text });
  } catch (err) {
    console.error("STT Error:", err.message);
    res.status(500).json({ error: "Speech to text failed" });
  }
};
