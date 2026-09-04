# Personal Gemini Journal

> A security-first personal journaling and brainstorming web application built with React, Node.js/Express, Tailwind CSS, and Google's Gemini models via `@google/genai`.

---

## 📖 Overview

**Personal Gemini Journal** is designed as a calm, distraction-free space for thoughtful reflection, strategic debriefs, and creative brainstorming. Prioritizing strict privacy and confidentiality, all journal reflections are processed server-side with zero client-side API key exposure, robust multi-tenant data isolation patterns, and automated synthesis checkpoints.

---

## ✨ Key Features

- **Empathetic AI Journaling**: Engage in deep, multi-turn conversational reflections tailored to personal growth, engineering debriefs, architecture trade-offs, and ideation.
- **Firebase Authentication & Account Management**: Complete Sign In and Sign Up workflows with one-click Google Authentication and Email/Password registration.
- **Durable Cloud Firestore Persistence**: User journals, reflections, and summaries automatically synchronize to isolated Firestore subcollections (`/users/{uid}/conversations`).
- **Automated Synthesis Checkpoints**: Every 5 conversation messages, the system automatically synthesizes the discussion into a concise 2-sentence summary and 3 bulleted key takeaways.
- **Multi-Conversation Management**: Easily create, rename, switch between, and delete conversation threads with real-time message tracking and timestamps.
- **Interactive Security Architecture Inspector**: An in-app drawer highlighting the threat model, subcollection security rules, API isolation policies, and data flow protections.
- **Multi-Profile Simulation & Guest Mode**: Explore the app in local guest mode or test multi-tenant cross-user isolation.
- **Quick-Start Prompts**: Pre-configured inspiration chips for Daily Debriefs, System Architecture & Trade-offs, Goal Setting, and Creative Ideation.
- **Accessible & Responsive Design**: Frosted glass aesthetics, WCAG-compliant color contrasts, smooth layout transitions, and full mobile/desktop responsiveness.

---

## 🛡️ Security & Architecture

1. **Zero Client-Side Leakage**:
   - The Gemini API key (`GEMINI_API_KEY`) is stored strictly on the server and accessed exclusively via `process.env.GEMINI_API_KEY`. It is never bundled into client JavaScript or exposed to browser network requests.
2. **Server-Side API Proxy**:
   - All AI interactions pass through the secure `/api/chat` route, ensuring request sanitization, length boundaries, and uniform error wrapping.
3. **Network Resilience Preflight (`network-patch.cjs`)**:
   - Forces IPv4 DNS lookup order to prevent container IPv6 blackholing.
   - Clamps TLS maximum send fragment size to 1024 bytes, preventing TCP packet drops across strict 1280-byte container MTU boundaries.
4. **Resilient Model Cascading & Quota Guardrails**:
   - Bounded request timeouts with dynamic fallback between active Gemini models (`gemini-3.1-flash-lite`, `gemini-3.5-flash`).
   - Clear, user-friendly messaging when daily free-tier request limits are encountered.
5. **Subcollection Data Isolation**:
   - Follows strict multi-tenant access control schemas (`/users/{uid}/conversations/{convId}/messages/{msgId}`), ensuring complete document privacy per user profile.

---

## 🛠️ Technology Stack

- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Backend**: [Express](https://expressjs.com/), [Node.js](https://nodejs.org/)
- **AI Integration**: [`@google/genai`](https://www.npmjs.com/package/@google/genai)
- **Tooling & Bundling**: [Vite](https://vitejs.dev/), [tsx](https://github.com/privatenumber/tsx), [esbuild](https://esbuild.github.io/)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Environment Configuration

Create a `.env` file in the root directory (or configure secrets in AI Studio):

```env
# Required: Google Gemini API key
GEMINI_API_KEY="your-gemini-api-key-here"

# Optional: Application hosting URL
APP_URL="http://localhost:3000"
```

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start the full-stack development server on http://localhost:3000
npm run dev
```

### Building for Production

```bash
# Compile client assets and bundle server code
npm run build

# Start the compiled production server
npm run start
```

### Type Checking & Linting

```bash
npm run lint
```

---

## 📡 API Reference

### `GET /api/health`
Checks server health status and timestamp.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-03T15:42:39.095Z"
}
```

### `POST /api/chat`
Sends a prompt and optional conversation history to Gemini.

**Request Body:**
```json
{
  "prompt": "Today I finalized our security boundaries and RBAC model.",
  "conversationId": "conv-1",
  "history": [
    { "sender": "user", "text": "Hello" },
    { "sender": "gemini", "text": "Hello! How are you feeling today?" }
  ]
}
```

**Response:**
```json
{
  "reply": "That sounds like a productive, mentally demanding day...",
  "timestamp": "2026-09-03T15:46:58.442Z",
  "messageCount": 4,
  "summaryCheckpoint": null
}
```

---

## 📂 Project Structure

```
├── .env.example          # Environment variable definitions
├── metadata.json         # AI Studio applet metadata & permissions
├── network-patch.cjs     # Preflight network patch (IPv4 + MTU fragment clamping)
├── index.html            # HTML entry point with metadata
├── package.json          # Scripts, dependencies, and bundle configuration
├── server.ts             # Express backend with Gemini API proxy & Vite middleware
├── src/
│   ├── App.tsx           # Main application interface and state management
│   ├── main.tsx          # React application mount point
│   ├── index.css         # Global styling and Tailwind imports
│   ├── types.ts          # Shared TypeScript interfaces and schemas
│   └── components/       # Extracted modular UI components
└── vite.config.ts        # Vite configuration
```

---

## 📄 License

This project is open-source and available under the standard MIT License.
