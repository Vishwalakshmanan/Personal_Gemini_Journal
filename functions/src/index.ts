/**
 * @file Cloud Functions (2nd Gen) for Personal Gemini Journal
 * @description Secure backend handling Gemini AI interactions, Firestore isolation,
 * and Secret Manager key retrieval.
 */

import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// ---------------------------------------------------------------------------
// 1. SECRET MANAGEMENT: Define secrets via Firebase Functions v2 / Secret Manager
// ---------------------------------------------------------------------------
const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");

/**
 * Fallback / Direct Programmatic Secret Manager Retrieval Pattern
 * Shows how to retrieve any secret dynamically using the GCP Secret Manager Client SDK.
 */
export async function getSecretFromSecretManager(secretName: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error("GCLOUD_PROJECT environment variable is missing.");
  }
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error(`Secret ${secretName} payload was empty.`);
  }
  return payload;
}

// ---------------------------------------------------------------------------
// 2. CORS CONFIGURATION: Strict Production Domain Whitelisting
// ---------------------------------------------------------------------------
const allowedOrigins = [
  process.env.APP_URL || "https://personal-gemini-journal.web.app",
  "https://personal-gemini-journal.firebaseapp.com",
];

const corsHandler = cors({
  origin: (origin, callback) => {
    // In production, reject undefined origins or origins not in whitelist
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".web.app") || origin.includes("localhost")) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation: Unauthorized origin"));
    }
  },
  credentials: true,
});

// ---------------------------------------------------------------------------
// 3. INPUT SANITIZATION & SECURITY HELPERS
// ---------------------------------------------------------------------------
function sanitizeInput(text: string): string {
  if (typeof text !== "string") {
    throw new HttpsError("invalid-argument", "Input must be a valid string");
  }
  // Trim and strip non-printable control characters (except newline, tab, carriage return)
  const sanitized = text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  if (sanitized.length === 0) {
    throw new HttpsError("invalid-argument", "Prompt cannot be empty");
  }
  if (sanitized.length > 8000) {
    throw new HttpsError("invalid-argument", "Prompt exceeds maximum allowed length of 8000 characters");
  }
  return sanitized;
}

/**
 * Verifies Firebase Auth ID Token from the Authorization Header
 * Enforces per-user authentication boundary
 */
async function authenticateRequest(req: any): Promise<admin.auth.DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Missing or malformed Authorization header");
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error("Token verification failure:", error);
    throw new HttpsError("unauthenticated", "Invalid or expired authentication token");
  }
}

// ---------------------------------------------------------------------------
// 4. CHAT WITH GEMINI CLOUD FUNCTION
// ---------------------------------------------------------------------------
export const chatWithGemini = onRequest(
  {
    secrets: [geminiApiKeySecret],
    timeoutSeconds: 60,
    memory: "512MiB",
    cors: false, // Handled manually for granular origin validation
  },
  async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        if (req.method !== "POST") {
          res.status(405).json({ error: "Method Not Allowed" });
          return;
        }

        // Auth verification: Token must be valid
        const userToken = await authenticateRequest(req);
        const authenticatedUserId = userToken.uid;

        // Parse and validate body parameters
        const { conversationId, prompt } = req.body;
        const sanitizedPrompt = sanitizeInput(prompt);

        if (!conversationId || typeof conversationId !== "string") {
          res.status(400).json({ error: "Invalid conversationId parameter" });
          return;
        }

        // Initialize Gemini with Secret retrieved securely via Secret Manager
        const apiKey = geminiApiKeySecret.value();
        if (!apiKey) {
          console.error("CRITICAL: GEMINI_API_KEY secret is unavailable");
          res.status(500).json({ error: "Service configuration error" });
          return;
        }

        const ai = new GoogleGenAI({ apiKey });

        // User Data Isolation Boundary:
        // Enforce Firestore path strictly under /users/{authenticatedUserId}/conversations/{conversationId}
        const conversationRef = db
          .collection("users")
          .doc(authenticatedUserId)
          .collection("conversations")
          .doc(conversationId);

        const conversationDoc = await conversationRef.get();
        const now = new Date().toISOString();

        if (!conversationDoc.exists) {
          // Initialize new conversation for this user
          await conversationRef.set({
            id: conversationId,
            userId: authenticatedUserId,
            title: sanitizedPrompt.slice(0, 50) + (sanitizedPrompt.length > 50 ? "..." : ""),
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
          });
        }

        const messagesRef = conversationRef.collection("messages");

        // Fetch recent messages for multi-turn conversational context (scoped to user)
        const historySnapshot = await messagesRef.orderBy("timestamp", "asc").limit(20).get();
        const conversationHistory: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];

        historySnapshot.forEach((doc) => {
          const data = doc.data();
          conversationHistory.push({
            role: data.sender === "user" ? "user" : "model",
            parts: [{ text: data.text }],
          });
        });

        // Append current user prompt
        conversationHistory.push({
          role: "user",
          parts: [{ text: sanitizedPrompt }],
        });

        // Persist User Message to isolated Firestore subcollection
        const userMessageId = messagesRef.doc().id;
        await messagesRef.doc(userMessageId).set({
          id: userMessageId,
          conversationId,
          sender: "user",
          text: sanitizedPrompt,
          timestamp: now,
        });

        // Call Gemini 1.5 Flash / Flash Latest with System Instruction for Journaling
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: conversationHistory,
          config: {
            systemInstruction:
              "You are a thoughtful, security-conscious personal journaling and brainstorming companion. " +
              "Help the user reflect on their ideas, organize complex thoughts, explore creative angles, " +
              "and provide empathetic, constructive insights. Keep responses clear, authentic, and inspiring.",
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        });

        const geminiReply = response.text || "I've noted that down in your journal.";
        const replyTimestamp = new Date().toISOString();

        // Persist Gemini Model Response to isolated Firestore subcollection
        const geminiMessageId = messagesRef.doc().id;
        await messagesRef.doc(geminiMessageId).set({
          id: geminiMessageId,
          conversationId,
          sender: "gemini",
          text: geminiReply,
          timestamp: replyTimestamp,
        });

        // Compute updated total message count
        const totalMessages = historySnapshot.size + 2; // previous + user + gemini
        await conversationRef.update({
          updatedAt: replyTimestamp,
          messageCount: totalMessages,
        });

        // -----------------------------------------------------------------------
        // AUTO-SUMMARIZATION: Triggered after every 5 messages
        // -----------------------------------------------------------------------
        let newSummary: any = null;
        if (totalMessages % 5 === 0) {
          try {
            // Fetch all messages for summarization
            const allMessagesSnapshot = await messagesRef.orderBy("timestamp", "asc").get();
            const transcript = allMessagesSnapshot.docs
              .map((d) => `${d.data().sender === "user" ? "Journaler" : "Gemini"}: ${d.data().text}`)
              .join("\n\n");

            const summaryPrompt =
              `Summarize the key reflections, themes, and brainstorming insights from this journal transcript:\n\n` +
              `${transcript}\n\n` +
              `Provide a concise narrative summary (2-3 sentences) followed by 3 key takeaway bullet points.`;

            const summaryResponse = await ai.models.generateContent({
              model: "gemini-3.8-flash",
              contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
              config: {
                systemInstruction: "You are an expert executive and psychological journaling summarizer.",
              },
            });

            const summaryText = summaryResponse.text || "Summary checkpoint generated.";
            const summariesRef = conversationRef.collection("summaries");
            const summaryId = summariesRef.doc().id;

            newSummary = {
              id: summaryId,
              conversationId,
              summaryText,
              messageCheckpoint: totalMessages,
              createdAt: replyTimestamp,
            };

            await summariesRef.doc(summaryId).set(newSummary);

            // Update conversation root with checkpoint
            await conversationRef.update({
              latestSummary: summaryText,
            });
          } catch (summaryErr) {
            // Log internally without failing the user response
            console.error("Auto-summarization background error:", summaryErr);
          }
        }

        // Return sanitized payload to client
        res.status(200).json({
          reply: geminiReply,
          messageId: geminiMessageId,
          timestamp: replyTimestamp,
          messageCount: totalMessages,
          autoSummary: newSummary,
        });
      } catch (err: any) {
        // OWASP Principle: Log complete stack traces internally; never leak to client
        console.error("chatWithGemini Internal Execution Error:", err);
        const statusCode = err.code === "unauthenticated" ? 401 : err.code === "invalid-argument" ? 400 : 500;
        res.status(statusCode).json({
          error: statusCode === 500 ? "An internal server error occurred while processing your request." : err.message,
        });
      }
    });
  }
);
