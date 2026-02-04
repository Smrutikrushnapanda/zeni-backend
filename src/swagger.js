const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Zeni AI Backend API",
      version: "1.0.0",
      description: "API documentation for Zeni AI Backend with AI chat, admin authentication, and speech-to-text features.",
      contact: {
        name: "API Support",
        email: "support@zeni.ai"
      },
      license: {
        name: "ISC",
        url: "https://opensource.org/licenses/ISC"
      }
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        Message: {
          type: "object",
          properties: {
            id: { type: "string" },
            role: { type: "string", enum: ["user", "assistant", "system"] },
            content: { type: "string" },
            timestamp: { type: "string", format: "date-time" }
          }
        },
        Chat: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            messages: { type: "array", items: { $ref: "#/components/schemas/Message" } },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        UserChats: {
          type: "object",
          properties: {
            chats: { type: "array", items: { $ref: "#/components/schemas/Chat" } },
            activeChat: { type: "string", nullable: true }
          }
        },
        ChatRequest: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string", description: "User message to send to AI" },
            sessionId: { type: "string", description: "Session ID for conversation continuity", default: "default" }
          }
        },
        SendOtpRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email", description: "Admin email address" }
          }
        },
        VerifyOtpRequest: {
          type: "object",
          required: ["email", "otp"],
          properties: {
            email: { type: "string", format: "email" },
            otp: { type: "string", description: "6-digit OTP code" }
          }
        },
        CreateChatRequest: {
          type: "object",
          required: ["id", "title"],
          properties: {
            id: { type: "string", description: "Unique chat ID" },
            title: { type: "string", description: "Chat title" }
          }
        },
        AddMessageRequest: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "object", description: "Message object with role and content" }
          }
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" }
          }
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            groqConnected: { type: "boolean" },
            resendConnected: { type: "boolean" },
            activeConversations: { type: "integer" },
            endpoints: { type: "object" }
          }
        },
        ChatResponse: {
          type: "object",
          properties: {
            reply: { type: "string" },
            sessionId: { type: "string" },
            timestamp: { type: "string", format: "date-time" }
          }
        },
        ConversationResponse: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            conversation: { type: "object" }
          }
        }
      }
    },
    tags: [
      { name: "Health", description: "Health check endpoints" },
      { name: "AI Chat", description: "AI chat and conversation management" },
      { name: "Admin Auth", description: "Admin authentication with OTP" },
      { name: "Chat Storage", description: "Chat history storage" },
      { name: "Speech to Text", description: "Audio to text conversion" }
    ]
  },
  // Paths to files containing OpenAPI annotations
  apis: ["./src/routes/*.js", "./src/index.js"]
};

// Generate OpenAPI specification
const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

