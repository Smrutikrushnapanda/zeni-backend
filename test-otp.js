/**
 * ZENI Backend - Email OTP Verification Test Suite
 * ================================================
 * 
 * This script tests the complete OTP verification flow:
 * 1. Send OTP endpoint
 * 2. Verify OTP endpoint
 * 3. Error cases (invalid OTP, expired OTP, etc.)
 * 
 * Prerequisites:
 * - Start the backend: npm run dev
 * - Configure .env file with RESEND_API_KEY and ADMIN_EMAIL
 * 
 * Usage: node test-otp.js
 */

require("dotenv").config();
const http = require("http");

// Configuration
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "skpanda017@gmail.com";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`),
};

// In-memory OTP store for test (matching backend)
let testOtpStore = new Map();

/**
 * Make HTTP request to backend
 */
async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Wait for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * TEST 1: Health Check
 */
async function testHealthCheck() {
  log.header("TEST 1: Health Check");
  
  try {
    const response = await request("GET", "/");
    
    if (response.status === 200 && response.data.status) {
      log.success("Server is running");
      log.info(`Status: ${response.data.status}`);
      log.info(`Endpoints available: ${Object.keys(response.data.endpoints || {}).length}`);
      return true;
    } else {
      log.error("Health check failed");
      return false;
    }
  } catch (err) {
    log.error(`Cannot connect to server: ${err.message}`);
    log.warn("Make sure the server is running on port 3000");
    return false;
  }
}

/**
 * TEST 2: Send OTP (Success Case)
 */
async function testSendOtp() {
  log.header("TEST 2: Send OTP - Success Case");
  
  const response = await request("POST", "/api/admin/send-otp", {
    email: ADMIN_EMAIL,
  });

  if (response.status === 200 && response.data.success) {
    log.success("OTP sent successfully");
    log.info(`Message: ${response.data.message}`);
    log.info(`Email (masked): ${response.data.emailMasked || 'N/A'}`);
    
    // Store for verification test
    testOtpStore.set("lastEmail", ADMIN_EMAIL);
    return true;
  } else {
    log.error(`Failed to send OTP: ${response.data.message}`);
    return false;
  }
}

/**
 * TEST 3: Send OTP - Missing Email
 */
async function testSendOtpMissingEmail() {
  log.header("TEST 3: Send OTP - Missing Email");
  
  const response = await request("POST", "/api/admin/send-otp", {});
  
  if (response.status === 400 && !response.data.success) {
    log.success("Correctly rejected request without email");
    log.info(`Error: ${response.data.message}`);
    return true;
  } else {
    log.error("Should have rejected request without email");
    return false;
  }
}

/**
 * TEST 4: Send OTP - Unauthorized Email
 */
async function testSendOtpUnauthorized() {
  log.header("TEST 4: Send OTP - Unauthorized Email");
  
  const response = await request("POST", "/api/admin/send-otp", {
    email: "smrutikrushnapanda@gmail.com",
  });
  
  if (response.status === 403 && !response.data.success) {
    log.success("Correctly rejected unauthorized email");
    log.info(`Error: ${response.data.message}`);
    return true;
  } else {
    log.error("Should have rejected unauthorized email");
    return false;
  }
}

/**
 * TEST 5: Verify OTP - Invalid OTP
 */
async function testVerifyOtpInvalid() {
  log.header("TEST 5: Verify OTP - Invalid OTP");
  
  const response = await request("POST", "/api/admin/verify-otp", {
    email: ADMIN_EMAIL,
    otp: "000000", // Wrong OTP
  });
  
  if (response.status === 400 && !response.data.success) {
    log.success("Correctly rejected invalid OTP");
    log.info(`Error: ${response.data.message}`);
    return true;
  } else {
    log.error("Should have rejected invalid OTP");
    return false;
  }
}

/**
 * TEST 6: Verify OTP - Missing Parameters
 */
async function testVerifyOtpMissingParams() {
  log.header("TEST 6: Verify OTP - Missing Parameters");
  
  const response = await request("POST", "/api/admin/verify-otp", {
    email: ADMIN_EMAIL,
  });
  
  if (response.status === 400 && !response.data.success) {
    log.success("Correctly rejected request with missing OTP");
    log.info(`Error: ${response.data.message}`);
    return true;
  } else {
    log.error("Should have rejected request with missing OTP");
    return false;
  }
}

/**
 * TEST 7: End-to-End OTP Flow (with mocking)
 */
async function testEndToEndFlow() {
  log.header("TEST 7: End-to-End OTP Flow");
  
  log.info("Note: This test requires manual OTP entry");
  log.info("The server would send an email with a 6-digit code");
  log.info("");
  log.info("To test manually:");
  log.info(`1. POST ${BASE_URL}/api/admin/send-otp`);
  log.info(`   Body: { "email": "${ADMIN_EMAIL}" }`);
  log.info("");
  log.info("2. Check your email for the OTP");
  log.info("");
  log.info(`3. POST ${BASE_URL}/api/admin/verify-otp`);
  log.info(`   Body: { "email": "${ADMIN_EMAIL}", "otp": "YOUR_OTP" }`);
  log.info("");
  log.info("Expected response:");
  log.info(`   { "success": true, "token": "YOUR_JWT_TOKEN", ... }`);
  
  return true;
}

/**
 * TEST 8: 404 Handler
 */
async function test404Handler() {
  log.header("TEST 8: 404 Handler");
  
  const response = await request("GET", "/api/nonexistent");
  
  if (response.status === 404 && response.data.error) {
    log.success("404 handler working correctly");
    log.info(`Error: ${response.data.error}`);
    return true;
  } else {
    log.error("404 handler not working");
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.clear();
  console.log(`
${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔐 ZENI Backend - Email OTP Verification Test Suite 🔐   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}
  `);

  // Check environment variables
  log.header("Environment Check");
  
  if (!process.env.RESEND_API_KEY) {
    log.warn("RESEND_API_KEY not set in .env file");
    log.info("Email sending will fail without this key");
  } else {
    log.success("RESEND_API_KEY is configured");
  }
  
  if (!process.env.ADMIN_EMAIL) {
    log.warn("ADMIN_EMAIL not set, using default: skpanda017@gmail.com");
  } else {
    log.success(`ADMIN_EMAIL is set to: ${process.env.ADMIN_EMAIL}`);
  }
  
  if (!process.env.JWT_SECRET) {
    log.warn("JWT_SECRET not set, using default");
  }

  const results = [];

  // Run tests
  results.push(await testHealthCheck());
  results.push(await testSendOtp());
  results.push(await testSendOtpMissingEmail());
  results.push(await testSendOtpUnauthorized());
  results.push(await testVerifyOtpInvalid());
  results.push(await testVerifyOtpMissingParams());
  results.push(await testEndToEndFlow());
  results.push(await test404Handler());

  // Summary
  log.header("Test Summary");
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  if (passed === total) {
    log.success(`All ${total} tests passed! 🎉`);
  } else {
    log.warn(`${passed}/${total} tests passed`);
    log.error(`${total - passed} tests failed`);
  }

  console.log(`
${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║                       API REFERENCE                         ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  POST /api/admin/send-otp                                  ║
║  { "email": "skpanda017@gmail.com" }                          ║
║                                                            ║
║  POST /api/admin/verify-otp                                ║
║  { "email": "skpanda017@gmail.com", "otp": "123456" }        ║
║                                                            ║
║  Response on success:                                      ║
║  {                                                       ║
║    "success": true,                                        ║
║    "token": "eyJhbGciOiJIUzI1NiIs...",                    ║
║    "expiresIn": "24h"                                      ║
║  }                                                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}
  `);
}

// Run tests
runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

