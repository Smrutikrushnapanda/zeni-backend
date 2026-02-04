const jwt = require("jsonwebtoken");
const sendOtpEmail = require("../utils/sendOtpEmail");

// In-memory OTP store (for single server deployment)
// For production with multiple instances, use Redis
const otpStore = new Map();

/**
 * Generate a 6-digit OTP
 * @returns {string} 6-digit OTP
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * STEP 1: Send OTP to admin email
 * POST /api/admin/send-otp
 * Body: { email }
 */
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }

    // Check if email is authorized
    if (email !== process.env.ADMIN_EMAIL) {
      console.log(`❌ Unauthorized OTP request for: ${email}`);
      return res.status(403).json({ 
        success: false, 
        message: "Not authorized" 
      });
    }

    // Generate OTP
    const otp = generateOtp();

    // Store OTP with expiration (5 minutes)
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
    });

    console.log(`📧 Sending OTP to ${email}: ${otp}`);

    // Send OTP via email
    await sendOtpEmail(email, otp);

    res.json({ 
      success: true, 
      message: "OTP sent successfully",
      // Include email mask for UI display (for development only)
      emailMasked: email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    });

  } catch (error) {
    console.error("❌ Send OTP Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send OTP",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * STEP 2: Verify OTP and generate JWT token
 * POST /api/admin/verify-otp
 * Body: { email, otp }
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate inputs
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and OTP are required" 
      });
    }

    // Check if OTP record exists
    const record = otpStore.get(email);

    if (!record) {
      console.log(`❌ OTP not found for: ${email}`);
      return res.status(400).json({ 
        success: false, 
        message: "OTP not found or already used" 
      });
    }

    // Check if OTP has expired
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      console.log(`❌ OTP expired for: ${email}`);
      return res.status(400).json({ 
        success: false, 
        message: "OTP has expired" 
      });
    }

    // Verify OTP matches
    if (record.otp !== otp) {
      console.log(`❌ Invalid OTP for: ${email}`);
      return res.status(400).json({ 
        success: false, 
        message: "Invalid OTP" 
      });
    }

    // OTP verified - delete from store (one-time use)
    otpStore.delete(email);

    // Generate JWT token
    const token = jwt.sign(
      { 
        email, 
        role: "admin" 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || "24h" 
      }
    );

    console.log(`✅ Admin verified: ${email}`);

    res.json({
      success: true,
      message: "OTP verified successfully",
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || "24h"
    });

  } catch (error) {
    console.error("❌ Verify OTP Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to verify OTP",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper: Clean expired OTPs (can be called periodically)
 */
exports.cleanExpiredOtps = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(email);
      cleaned++;
    }
  }

  console.log(`🧹 Cleaned ${cleaned} expired OTPs`);
  return cleaned;
};

/**
 * Get OTP store stats (for debugging)
 */
exports.getOtpStats = () => {
  const now = Date.now();
  let valid = 0;
  let expired = 0;

  for (const record of otpStore.values()) {
    if (now > record.expiresAt) {
      expired++;
    } else {
      valid++;
    }
  }

  return {
    total: otpStore.size,
    valid,
    expired
  };
};

