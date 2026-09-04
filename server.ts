import "./network-patch.cjs";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure all /api responses default to JSON
  app.use("/api", (req, res, next) => {
    res.setHeader("Content-Type", "application/json");
    next();
  });

  // Input Sanitization Helper
  function sanitizePrompt(text: any): string {
    if (typeof text !== "string") {
      throw new Error("Prompt must be a string");
    }
    const clean = text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    if (clean.length === 0) {
      throw new Error("Prompt cannot be empty");
    }
    if (clean.length > 8000) {
      throw new Error("Prompt exceeds 8000 character limit");
    }
    return clean;
  }

  // Server-Side Gemini API Proxy with OWASP protection & secret isolation
  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.",
        });
      }

      const { prompt, history, conversationId } = req.body;
      const sanitizedPrompt = sanitizePrompt(prompt);

      // Initialize GoogleGenAI client with required User-Agent header
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Build conversation contents
      const contents: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];

      if (Array.isArray(history)) {
        for (const item of history.slice(-20)) {
          if (item && item.sender && item.text) {
            contents.push({
              role: item.sender === "user" ? "user" : "model",
              parts: [{ text: String(item.text) }],
            });
          }
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: sanitizedPrompt }],
      });

      // Models to try in order of active free-tier quota and responsiveness
      const targetModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
      let response: any = null;
      let lastError: any = null;

      for (const model of targetModels) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`API request timed out for model ${model}`)), 18000)
          );

          const generatePromise = ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction:
                "You are a thoughtful, empathetic, and security-conscious personal journaling and brainstorming assistant. " +
                "Provide insightful reflections, creative brainstorming avenues, constructive organization of thoughts, " +
                "and concise summaries when appropriate. Keep your tone articulate, authentic, and grounded.",
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          });

          response = await Promise.race([generatePromise, timeoutPromise]);
          if (response && response.text) {
            break;
          }
        } catch (mErr: any) {
          console.warn(`Model ${model} failed, trying next:`, mErr?.message || mErr);
          lastError = mErr;
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error("Failed to receive a valid response from the Gemini model.");
      }

      const reply = response.text || "I have received and reflected upon your journal thoughts.";

      // Check if auto-summary is needed (e.g. at 5-message checkpoints)
      const currentCount = (Array.isArray(history) ? history.length : 0) + 2;
      let summaryCheckpoint: any = null;

      if (currentCount % 5 === 0) {
        try {
          const summaryPrompt = `Generate a concise 2-sentence summary and 3 bulleted insights for this journal reflection:\n\nUser: ${sanitizedPrompt}\nGemini: ${reply}`;
          const summaryRes = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
          });
          summaryCheckpoint = {
            id: `sum_${Date.now()}`,
            summaryText: summaryRes.text || "Checkpoint summary generated.",
            messageCheckpoint: currentCount,
            createdAt: new Date().toISOString(),
          };
        } catch (sumErr) {
          console.error("Checkpoint auto-summary error:", sumErr);
        }
      }

      return res.status(200).json({
        reply,
        timestamp: new Date().toISOString(),
        messageCount: currentCount,
        summaryCheckpoint,
      });
    } catch (error: any) {
      console.error("Server /api/chat error:", error);
      const isValidation = error.message?.includes("Prompt");
      let userFriendlyMessage = error.message || "An internal error occurred while generating a response.";
      if (userFriendlyMessage.includes("RESOURCE_EXHAUSTED") || userFriendlyMessage.includes("429")) {
        userFriendlyMessage = "Gemini API request limit reached for today. Please wait a brief moment or check your API key in Settings.";
      }
      return res.status(isValidation ? 400 : 500).json({
        error: userFriendlyMessage,
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Catch-all for API 404s to ensure JSON is returned instead of HTML
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.originalUrl} not found` });
  });

  // Vite middleware in dev or static dist in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Personal Gemini Journal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
