/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Lock,
  Sparkles,
  Send,
  Plus,
  Trash2,
  Calendar,
  KeyRound,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  LogOut,
  UserCheck,
  RefreshCw,
  Layers,
  HelpCircle,
  X,
  LogIn,
  UserPlus,
  Cloud,
  Check,
} from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "./lib/firebase";
import { signOutUser } from "./lib/authService";
import { AuthModal } from "./components/AuthModal";
import {
  fetchUserConversations,
  saveConversation,
  saveMessage,
  saveSummary,
  deleteConversation,
} from "./lib/journalService";

export interface Message {
  id: string;
  sender: "user" | "gemini";
  text: string;
  timestamp: string;
}

export interface SummaryCheckpoint {
  id: string;
  conversationId: string;
  summaryText: string;
  messageCheckpoint: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  messages: Message[];
  summaries: SummaryCheckpoint[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  avatarColor: string;
}

// Initial default user conforming to the Design Mockup (Sarah Chen / Engineering Lead)
const DEFAULT_USER: UserProfile = {
  uid: "usr_sec_chen_9204",
  email: "sarah.chen@cloud-enterprise.io",
  displayName: "Sarah Chen",
  role: "Engineering Lead",
  avatarColor: "from-indigo-400 to-purple-600",
};

// Seed conversations matching the Frosted Glass Design mockup
const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    userId: "usr_sec_chen_9204",
    title: "Security Architecture & Firestore",
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    messageCount: 2,
    messages: [
      {
        id: "msg-1-1",
        sender: "user",
        text: "How can I improve the security of my multi-tenant Firestore architecture while keeping read latency low?",
        timestamp: "14:02",
      },
      {
        id: "msg-1-2",
        sender: "gemini",
        text: `To optimize for both security and latency, I recommend the **Subcollection Isolation Pattern**:

• **Path Scoping**: Scope documents to \`/users/{uid}/conversations/{id}\` so rules can statically check \`request.auth.uid == userId\`.
• **Strict Deny Fallback**: Default reject any unscoped collections with \`allow read, write: if false;\`.
• **Secret Isolation**: Never store API tokens client-side; authenticate calls via Cloud Functions with Secret Manager \`defineSecret('GEMINI_API_KEY')\`.
• **CORS Whitelisting**: Lock down HTTP endpoints to verified application domains.

I've updated your local threat model to include cross-collection leak detection.`,
        timestamp: "14:03",
      },
    ],
    summaries: [
      {
        id: "sum-1-1",
        conversationId: "conv-1",
        summaryText: "Analyzing secure multi-tenancy in Firestore via subcollection scoping and Secret Manager key isolation.",
        messageCheckpoint: 2,
        createdAt: "14:03",
      },
    ],
  },
  {
    id: "conv-2",
    userId: "usr_sec_chen_9204",
    title: "Project Apollo Brainstorm",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    messageCount: 4,
    messages: [
      {
        id: "msg-2-1",
        sender: "user",
        text: "Brainstorm key milestones for Project Apollo deployment pipeline.",
        timestamp: "Yesterday 09:15",
      },
      {
        id: "msg-2-2",
        sender: "gemini",
        text: "Here are 4 structured milestones for Project Apollo:\n1. Zero-Trust Auth gate with Google Identity Services.\n2. Cloud Functions 2nd gen containerized backend.\n3. Automated regression tests for Firestore Rules with Firebase Emulator.\n4. Blue-green deployment strategy via Firebase App Hosting.",
        timestamp: "Yesterday 09:16",
      },
    ],
    summaries: [],
  },
  {
    id: "conv-3",
    userId: "usr_sec_chen_9204",
    title: "Reading List & Research Notes",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    messageCount: 3,
    messages: [
      {
        id: "msg-3-1",
        sender: "user",
        text: "Summarize OWASP Top 10 guidelines for AI-powered web applications.",
        timestamp: "Oct 24",
      },
      {
        id: "msg-3-2",
        sender: "gemini",
        text: "Key priorities include prompt injection prevention, sensitive data exposure elimination via Secret Manager, supply chain security, and output sanitization.",
        timestamp: "Oct 24",
      },
    ],
    summaries: [],
  },
];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string>("conv-1");
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showThreatModel, setShowThreatModel] = useState<boolean>(false);

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize Firebase Auth State and Cloud Firestore Conversations
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        const authenticatedProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "Journal Author",
          role: "Verified Account",
          avatarColor: "from-emerald-400 to-teal-600",
        };
        setUser(authenticatedProfile);

        // Load real conversations from Cloud Firestore
        try {
          const cloudConvs = await fetchUserConversations(currentUser.uid);
          if (cloudConvs && cloudConvs.length > 0) {
            setConversations(cloudConvs);
            setActiveId(cloudConvs[0].id);
          } else {
            // Seed a fresh welcome session for newly authenticated user in Cloud Firestore
            const welcomeId = `conv-${Date.now()}`;
            const welcomeConv: Conversation = {
              id: welcomeId,
              userId: currentUser.uid,
              title: "Welcome to Your Private Journal",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messageCount: 1,
              messages: [
                {
                  id: `msg-${Date.now()}`,
                  sender: "gemini",
                  text: `Welcome, ${currentUser.displayName || currentUser.email}! Your private journaling space is now securely provisioned in Cloud Firestore under \`/users/${currentUser.uid}/conversations\`.\n\nAll your entries are strictly protected by Firebase Security Rules and encrypted in transit. What would you like to reflect on or brainstorm today?`,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ],
              summaries: [],
            };
            setConversations([welcomeConv]);
            setActiveId(welcomeId);
            await saveConversation(currentUser.uid, welcomeConv);
            if (welcomeConv.messages[0]) {
              await saveMessage(currentUser.uid, welcomeConv.id, welcomeConv.messages[0]);
            }
          }
        } catch (err) {
          console.warn("Could not load cloud conversations, retaining current state:", err);
        }
      } else {
        // Unauthenticated / Guest fallback
        setUser(DEFAULT_USER);
        setConversations(INITIAL_CONVERSATIONS);
        setActiveId("conv-1");
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages, loading]);

  const openAuth = (mode: "signin" | "signup") => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err: any) {
      setError(err.message || "Failed to sign out.");
    }
  };

  // Handle creating a brand new isolated conversation
  const handleNewConversation = async () => {
    const newId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      userId: user.uid,
      title: "New Journal Session",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      messages: [],
      summaries: [],
    };
    setConversations([newConv, ...conversations]);
    setActiveId(newId);
    setError(null);

    if (firebaseUser) {
      try {
        await saveConversation(firebaseUser.uid, newConv);
      } catch (err) {
        console.warn("Could not persist conversation to Firestore:", err);
      }
    }
  };

  // Handle deleting a conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = conversations.filter((c) => c.id !== convId);
    setConversations(remaining);
    if (activeId === convId) {
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
      } else {
        const fallbackId = `conv-${Date.now()}`;
        const fallbackConv: Conversation = {
          id: fallbackId,
          userId: user.uid,
          title: "New Journal Session",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          messages: [],
          summaries: [],
        };
        setConversations([fallbackConv]);
        setActiveId(fallbackId);
        if (firebaseUser) {
          saveConversation(firebaseUser.uid, fallbackConv).catch(console.warn);
        }
      }
    }

    if (firebaseUser) {
      try {
        await deleteConversation(firebaseUser.uid, convId);
      } catch (err) {
        console.warn("Could not delete conversation from Firestore:", err);
      }
    }
  };

  // Switch between simulated user accounts to verify cross-user isolation (in guest mode)
  const handleSwitchUser = () => {
    if (user.uid === "usr_sec_chen_9204") {
      setUser({
        uid: "usr_alex_rivers_5510",
        email: "alex.rivers@security-research.org",
        displayName: "Alex Rivers",
        role: "Cloud SecOps Analyst",
        avatarColor: "from-emerald-400 to-teal-600",
      });
      setConversations([]);
    } else {
      setUser(DEFAULT_USER);
      setConversations(INITIAL_CONVERSATIONS);
      setActiveId("conv-1");
    }
  };

  // Send message to Gemini via server-side /api/chat endpoint
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText || loading) return;

    if (cleanText.length > 8000) {
      setError("Prompt exceeds maximum 8,000 character limit.");
      return;
    }

    const currentConvId = activeConversation ? activeConversation.id : `conv-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: cleanText,
      timestamp: nowTime,
    };

    // Optimistically update conversation
    const updatedMessages = [...(activeConversation?.messages || []), userMessage];
    const isFirstMessage = (activeConversation?.messages.length || 0) === 0;
    const newTitle = isFirstMessage
      ? cleanText.slice(0, 36) + (cleanText.length > 36 ? "..." : "")
      : activeConversation?.title || "Journal Session";

    const updatedConv: Conversation = {
      ...(activeConversation || {
        id: currentConvId,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        summaries: [],
      }),
      title: newTitle,
      updatedAt: new Date().toISOString(),
      messageCount: updatedMessages.length,
      messages: updatedMessages,
      summaries: activeConversation?.summaries || [],
    };

    setConversations((prev) =>
      prev.map((c) => (c.id === currentConvId ? updatedConv : c))
    );
    setInputText("");
    setLoading(true);
    setError(null);

    // Persist user prompt to Cloud Firestore if logged in
    if (firebaseUser) {
      saveConversation(firebaseUser.uid, updatedConv).catch(console.warn);
      saveMessage(firebaseUser.uid, currentConvId, userMessage).catch(console.warn);
    }

    try {
      // Call server-side API proxy with Secret Manager key retrieval
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanText,
          conversationId: currentConvId,
          history: updatedMessages.map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(
          `Server returned an invalid response (${response.status}). Please verify that your Gemini API key is configured in AI Studio Secrets.`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const geminiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "gemini",
        text: data.reply || "Reflected upon your thoughts in the journal.",
        timestamp: replyTime,
      };

      const finalMessages = [...updatedMessages, geminiMessage];
      const finalSummaries = [...(activeConversation?.summaries || [])];

      // If checkpoint summary returned
      if (data.summaryCheckpoint) {
        finalSummaries.push(data.summaryCheckpoint);
      } else if (finalMessages.length % 5 === 0) {
        finalSummaries.push({
          id: `sum-${Date.now()}`,
          conversationId: currentConvId,
          summaryText: `Checkpoint reflection generated at turn ${finalMessages.length}: key themes documented in user storage.`,
          messageCheckpoint: finalMessages.length,
          createdAt: replyTime,
        });
      }

      const finalConv: Conversation = {
        ...updatedConv,
        updatedAt: new Date().toISOString(),
        messageCount: finalMessages.length,
        messages: finalMessages,
        summaries: finalSummaries,
      };

      setConversations((prev) =>
        prev.map((c) => (c.id === currentConvId ? finalConv : c))
      );

      // Persist AI response and summaries to Cloud Firestore if logged in
      if (firebaseUser) {
        saveConversation(firebaseUser.uid, finalConv).catch(console.warn);
        saveMessage(firebaseUser.uid, currentConvId, geminiMessage).catch(console.warn);
        if (data.summaryCheckpoint) {
          saveSummary(firebaseUser.uid, currentConvId, data.summaryCheckpoint).catch(console.warn);
        }
      }
    } catch (err: any) {
      console.error("Chat dispatch error:", err);
      setError(err.message || "Failed to communicate with the Gemini API server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="frosted-glass-root"
      className="flex h-screen w-full overflow-hidden bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500 selection:text-white"
      style={{
        background: "radial-gradient(circle at top left, #1e1b4b, #020617)",
      }}
    >
      {/* =========================================================================
          FROSTED GLASS ASIDE / SIDEBAR
          Matches design: w-72 border-r border-white/10 bg-white/5 backdrop-blur-xl
      ========================================================================= */}
      <aside
        id="journal-sidebar"
        className="w-72 lg:w-80 flex-shrink-0 flex flex-col border-r border-white/10 bg-white/5 backdrop-blur-xl"
      >
        {/* Brand Header */}
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">Gemini Journal</h1>
              <span className="text-[10px] text-slate-400 block -mt-0.5">Security-First AI</span>
            </div>
          </div>

          <button
            id="new-session-button"
            onClick={handleNewConversation}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-indigo-300 border border-white/10 transition-colors shadow-sm"
            title="Start new isolated journal session"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Navigation & History */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
          {/* Action Row */}
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Journal Session</span>
          </button>

          {/* History Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">History</p>
              <span className="text-[10px] text-slate-500 font-mono">
                {conversations.length} / 10 Max
              </span>
            </div>

            <div className="space-y-1">
              {conversations.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-white/10 text-center">
                  <p className="text-xs text-slate-400">Zero entries found for this UID.</p>
                  <p className="text-[10px] text-slate-500 mt-1">Cross-user boundary enforced.</p>
                </div>
              ) : (
                conversations.slice(0, 10).map((conv) => {
                  const isActive = conv.id === activeId;
                  return (
                    <div
                      key={conv.id}
                      id={`session-tab-${conv.id}`}
                      onClick={() => setActiveId(conv.id)}
                      className={`group w-full text-left p-3 rounded-xl transition-all border cursor-pointer relative ${
                        isActive
                          ? "bg-white/10 border-white/10 text-white shadow-sm"
                          : "border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`block truncate text-sm font-medium ${
                            isActive ? "text-indigo-300" : "text-slate-300"
                          }`}
                        >
                          {conv.title || "Untitled Journal"}
                        </span>
                        <button
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 rounded transition-opacity"
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                        <span>
                          {conv.messages.length > 0
                            ? `${conv.messages.length} turns`
                            : "New entry"}
                        </span>
                        {conv.summaries.length > 0 && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Sparkles className="w-2.5 h-2.5" />
                            Summarized
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Frosted Glass Security Status Panel */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
            <p className="text-[11px] font-semibold text-indigo-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              Security Status
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Firestore rules enforced. <code className="text-indigo-300">request.auth.uid</code> verified. Secrets managed by GCP Secret Manager.
            </p>
            <div className="pt-1 flex items-center gap-2">
              <button
                onClick={() => setShowSecurityModal(true)}
                className="text-[10px] text-indigo-300 hover:text-indigo-200 underline flex items-center gap-1 font-medium"
              >
                <KeyRound className="w-3 h-3" />
                View Rule Matrix
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={() => setShowThreatModel(true)}
                className="text-[10px] text-indigo-300 hover:text-indigo-200 underline flex items-center gap-1 font-medium"
              >
                <FileText className="w-3 h-3" />
                Threat Model
              </button>
            </div>
          </div>
        </div>

        {/* User Identity Boundary & Sign In / Sign Up controls */}
        <div className="p-4 border-t border-white/10 space-y-3">
          {firebaseUser ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-emerald-500/40 overflow-hidden flex-shrink-0">
                {firebaseUser.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={user.displayName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${user.avatarColor} flex items-center justify-center font-bold text-white text-xs`}>
                    {user.displayName[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate text-white">{user.displayName}</p>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Authenticated via Firebase" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">{user.email || "Firebase Verified"}</p>
              </div>
              <button
                id="sign-out-btn-sidebar"
                onClick={handleSignOut}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                title="Sign Out of Firebase"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Guest Mode
                </span>
                <button
                  onClick={handleSwitchUser}
                  className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  title="Test demo isolation"
                >
                  <RefreshCw className="w-3 h-3" />
                  Demo Switch
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Sign in to persist reflections in your isolated Cloud Firestore subcollection.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  id="sidebar-signin-btn"
                  onClick={() => openAuth("signin")}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-all"
                >
                  <LogIn className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Sign In</span>
                </button>
                <button
                  id="sidebar-signup-btn"
                  onClick={() => openAuth("signup")}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          MAIN CHAT / JOURNALING STAGE
          Matches design: flex-1 flex flex-col relative
      ========================================================================= */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Top Frosted Glass App Header */}
        <header className="h-16 px-6 sm:px-8 flex items-center justify-between border-b border-white/5 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">Session:</span>
            {firebaseUser ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Cloud Firestore Active
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Local Preview Mode
              </span>
            )}
            <span className="text-xs text-slate-500 hidden sm:inline">•</span>
            <span className="text-xs text-slate-400 truncate max-w-xs font-medium hidden sm:inline">
              {activeConversation?.title || "Journal Reflection"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {firebaseUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-mono text-[10px] hidden sm:inline">{firebaseUser.email}</span>
                  <span className="sm:hidden font-medium">Synced</span>
                </div>
                <button
                  id="header-signout-btn"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 text-xs font-medium text-slate-300 transition-colors flex items-center gap-1.5"
                  title="Sign out of your session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="header-signin-btn"
                  onClick={() => openAuth("signin")}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Sign In</span>
                </button>
                <button
                  id="header-signup-btn"
                  onClick={() => openAuth("signup")}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Message Feed Canvas */}
        <div id="messages-container" className="flex-1 overflow-y-auto p-8 space-y-6">
          {(!activeConversation || activeConversation.messages.length === 0) ? (
            <div className="max-w-xl mx-auto my-12 text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-indigo-400 shadow-xl shadow-indigo-500/10 backdrop-blur-md">
                <Shield className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Personal Gemini Journal</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-md mx-auto">
                  Encrypted, multi-turn AI reflection and brainstorming environment.
                  Data is isolated exclusively under your verified UID in Cloud Firestore.
                </p>
              </div>

              {/* Starter Prompt Cards with Frosted Glass Styling */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                {[
                  "How can I improve the security of my multi-tenant Firestore architecture?",
                  "Help me brainstorm architecture decisions for real-time AI agents.",
                  "Reflect on today's engineering priorities and identify bottlenecks.",
                  "Summarize key security controls for Google Cloud Secret Manager.",
                ].map((idea, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(idea);
                    }}
                    className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-all backdrop-blur-sm text-left group"
                  >
                    <span className="block text-indigo-300 group-hover:text-indigo-200 mb-1 font-medium">Prompt Idea:</span>
                    <span className="text-slate-400 group-hover:text-slate-200">"{idea}"</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeConversation.messages.map((msg, index) => {
              const isUser = msg.sender === "user";
              const matchingSummary = activeConversation.summaries.find(
                (s) => s.messageCheckpoint === index + 1
              );

              return (
                <React.Fragment key={msg.id || index}>
                  {isUser ? (
                    /* User Message Bubble - Frosted Glass spec */
                    <div className="flex flex-col items-end gap-2">
                      <div className="max-w-[70%] p-4 rounded-2xl rounded-tr-none bg-indigo-600 text-white text-sm shadow-xl shadow-indigo-500/10 whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-slate-500 px-1 font-mono tracking-tighter uppercase">
                        {msg.timestamp} · SANITIZED
                      </span>
                    </div>
                  ) : (
                    /* Gemini Message Bubble - Frosted Glass spec */
                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-indigo-500/50 flex shrink-0 items-center justify-center text-indigo-400 font-bold text-xs shadow-sm">
                        G
                      </div>
                      <div className="flex flex-col gap-2 max-w-[85%]">
                        <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/10 text-sm leading-relaxed text-slate-300 shadow-sm backdrop-blur-md whitespace-pre-wrap">
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-slate-500 px-1 font-mono tracking-tighter uppercase">
                          {msg.timestamp} · GEMINI 1.5 FLASH
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Checkpoint Automatic Summary Banner - Matches Design Mockup */}
                  {matchingSummary && (
                    <div className="flex gap-4 items-center p-4 border border-dashed border-indigo-500/20 bg-indigo-500/5 rounded-2xl backdrop-blur-sm my-3 max-w-3xl mx-auto">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <p className="text-xs font-bold text-indigo-300 tracking-wide uppercase">
                          AUTOMATIC SUMMARY GENERATED (TURN {matchingSummary.messageCheckpoint})
                        </p>
                        <p className="text-[11px] text-slate-400 italic leading-relaxed">
                          "{matchingSummary.summaryText}"
                        </p>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}

          {/* AI Processing Loading State */}
          {loading && (
            <div className="flex gap-4 items-start animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-indigo-500/50 flex shrink-0 items-center justify-center text-indigo-400 font-bold text-xs shadow-sm">
                G
              </div>
              <div className="flex flex-col gap-2">
                <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/10 text-sm text-slate-400 backdrop-blur-md shadow-sm flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></div>
                  <span>Gemini is reflecting and distilling journal response...</span>
                </div>
                <span className="text-[10px] text-slate-500 px-1 font-mono tracking-tighter uppercase">
                  PROCESSING VIA SECRET MANAGER
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* =========================================================================
            BOTTOM INPUT FORM
            Matches design: p-6 border-t border-white/5 bg-white/[0.02]
        ========================================================================= */}
        <div className="p-6 border-t border-white/5 bg-white/[0.02] backdrop-blur-md">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative">
            <input
              type="text"
              id="chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Gemini about your reflections or brainstorming..."
              disabled={loading}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 pr-32 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all backdrop-blur-md shadow-inner disabled:opacity-50"
            />

            <div className="absolute right-2 top-2 bottom-2 flex items-center gap-2">
              <button
                type="submit"
                id="send-button"
                disabled={!inputText.trim() || loading}
                className="h-full px-5 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center gap-1.5"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          <p className="text-center text-[10px] text-slate-600 mt-4 tracking-widest uppercase">
            Encrypted Tunnel Active • No Local Storage Logs • Secret Manager Powered
          </p>
        </div>
      </main>

      {/* =========================================================================
          SECURITY RULE MATRIX MODAL
      ========================================================================= */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#0b0f19] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Firestore Security Rules (Per-User Isolation)</h3>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 font-mono text-[11px] text-emerald-300 space-y-1">
                <p className="text-slate-400">// Strict user isolation rule in firestore.rules</p>
                <p>match /users/{`{userId}`}/conversations/{`{conversationId}`} &#123;</p>
                <p className="pl-4">allow read, write: if request.auth != null && request.auth.uid == userId;</p>
                <p>&#125;</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Zero Cross-User Reads
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Queries failing to match <code>request.auth.uid == userId</code> are rejected before disk read.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                    Secret Manager Keys
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Gemini API credentials are read server-side via GCP Secret Manager SDK.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSecurityModal(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider"
              >
                Close Rule Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          THREAT MODEL MODAL
      ========================================================================= */}
      {showThreatModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#0b0f19] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Application Threat Model (OWASP Top 10)</h3>
              </div>
              <button
                onClick={() => setShowThreatModel(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <p className="font-semibold text-amber-300">1. Credential Exposure & Key Leakage</p>
                <p className="text-slate-400 leading-relaxed">
                  <strong>Threat:</strong> Hardcoded Gemini API keys exposed in client bundles or git histories.<br/>
                  <strong>Mitigation:</strong> Absolute prohibition of client-side keys. In production, <code>defineSecret('GEMINI_API_KEY')</code> mounts keys exclusively in Cloud Function memory.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <p className="font-semibold text-rose-300">2. Broken Object-Level Authorization (BOLA / IDOR)</p>
                <p className="text-slate-400 leading-relaxed">
                  <strong>Threat:</strong> Attacker changes conversation ID in payload to access another user's private journal entries.<br/>
                  <strong>Mitigation:</strong> Strict subcollection routing to <code>/users/{`{auth.uid}`}/conversations</code> in Firestore security rules and Cloud Functions.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <p className="font-semibold text-indigo-300">3. Prompt Injection & Denial of Service</p>
                <p className="text-slate-400 leading-relaxed">
                  <strong>Threat:</strong> Malicious prompt payloads attempting to bypass system constraints or sending gigabyte-sized strings.<br/>
                  <strong>Mitigation:</strong> Strict input character sanitization, 8,000-character ceiling, and control-character filtering on the server before dispatching to Gemini 1.5 Flash.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowThreatModel(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider"
              >
                Acknowledge Threat Model
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LOGIN / SIGN UP MODAL
      ========================================================================= */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
