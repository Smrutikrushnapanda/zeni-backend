const axios = require("axios");

console.log("✅ Groq key loaded:", process.env.GROQ_API_KEY?.slice(0, 8));

const groq = axios.create({
  baseURL: "https://api.groq.com/openai/v1",
  headers: {
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json",
  },
});

async function askGroq(message) {
  const response = await groq.post("/chat/completions", {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: "You are Zeni AI, a helpful assistant." },
      { role: "user", content: message },
    ],
  });

  return response.data.choices[0].message.content;
}

module.exports = askGroq;
