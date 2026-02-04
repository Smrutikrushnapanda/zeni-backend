const { Resend } = require("resend");

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP email to the specified address
 * @param {string} email - Recipient email address
 * @param {string} otp - One-time password to send
 * @returns {Promise<object>} - Resend API response
 */
const sendOtpEmail = async (email, otp) => {
  try {
    const result = await resend.emails.send({
      from: "Zeni Admin <onboarding@resend.dev>",
      to: email,
      subject: "Your Admin Login OTP",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #22c55e 0%, #ffffff 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #166534; margin: 0;">🔐 Zeni Admin</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Your Login OTP</h2>
            <p style="color: #666;">Use the following OTP to verify your identity:</p>
            <div style="background: #fff; border: 2px dashed #22c55e; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #166534;">${otp}</span>
            </div>
            <p style="color: #999; font-size: 14px;">⏱️ This OTP is valid for 5 minutes</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">If you didn't request this OTP, please ignore this email.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`✅ OTP email sent to ${email}:`, result.data?.id);
    return result;
  } catch (error) {
    console.error(`❌ Failed to send OTP email to ${email}:`, error);
    throw error;
  }
};

module.exports = sendOtpEmail;

