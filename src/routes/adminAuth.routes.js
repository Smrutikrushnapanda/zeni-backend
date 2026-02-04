const express = require("express");
const router = express.Router();
const {
  sendOtp,
  verifyOtp,
} = require("../controllers/adminAuth.controller");

/**
 * @swagger
 * /api/admin/send-otp:
 *   post:
 *     summary: Send OTP to admin email
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendOtpRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Email is required
 *       500:
 *         description: Server error
 */
router.post("/send-otp", sendOtp);

/**
 * @swagger
 * /api/admin/verify-otp:
 *   post:
 *     summary: Verify OTP and authenticate admin
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *       401:
 *         description: Unauthorized
 */
router.post("/verify-otp", verifyOtp);

module.exports = router;
