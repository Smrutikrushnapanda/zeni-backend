const express = require("express");
const upload = require("../middlewares/upload");
const { speechToText } = require("../controllers/stt.controller");

const router = express.Router();

router.post("/", upload.single("audio"), speechToText);

module.exports = router;
