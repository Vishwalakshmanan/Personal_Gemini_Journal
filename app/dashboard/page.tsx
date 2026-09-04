"use client";

/**
 * @file app/dashboard/page.tsx
 * @description Protected Dashboard for Personal Gemini Journal.
 * Validates authentication session, syncs with isolated Firestore subcollections,
 * and handles multi-turn AI interactions.
 */

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { Auth } from "../../components/Auth";
import { HistoryList, ConversationItem } from "../../components/HistoryList";
import { ChatInterface, ChatMessage, SummaryCheckpoint } from "../../components/ChatInterface";
import { useRouter } from "next/navigation";
import { Shield, Sparkles, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [summaries, setSummaries] = useState<SummaryCheckpoint[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 1. Enforce Authentication Boundary (Client Route Guard)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        // Redirect unauthenticated visitor to landing page
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch User's Isolated Conversations (Scoped to request.auth.uid)
  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    // Path enforced strictly to /users/{user.uid}/conversations
    const convsQuery = query(
      collection(db, "users", user.uid, "conversations"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      convsQuery,
      (snapshot) => {
        const list: ConversationItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            userId: user.uid,
            title: d.title || "Untitled Journal",
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt || new Date().toISOString(),
            updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt || new Date().toISOString(),
            messageCount: d.messageCount || 0,
            latestSummary: d.latestSummary,
          });
        });
        setConversations(list);
        if (!activeConvId && list.length > 0) {
          setActiveConvId(list[0].id);
        }
      },
      (firestoreErr) => {
        console.error("Firestore Security Isolation Denied:", firestoreErr);
        setError("Unable to load journal entries. Access rejected by security rules.");
      }
    );

    return () => unsubscribe();
  }, [user, activeConvId]);

  // 3. Listen to Messages and Checkpoint Summaries for Active Conversation
  useEffect(() => {
    if (!user || !activeConvId) {
      setMessages([]);
      setSummaries([]);
      return;
    }

    // Messages subcollection listener
    const messagesQuery = query(
      collection(db, "users", user.uid, "conversations", activeConvId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        msgs.push({
          id: docSnap.id,
          sender: d.sender,
          text: d.text,
          timestamp: d.timestamp || new Date().toISOString(),
        });
      });
      setMessages(msgs);
    });

    // Summaries subcollection listener
    const summariesQuery = query(
      collection(db, "users", user.uid, "conversations", activeConvId, "summaries"),
      orderBy("messageCheckpoint", "asc")
    );

    const unsubSummaries = onSnapshot(summariesQuery, (snapshot) => {
      const sums: SummaryCheckpoint[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        sums.push({
          id: docSnap.id,
          conversationId: activeConvId,
          summaryText: d.summaryText,
          messageCheckpoint: d.messageCheckpoint,
          createdAt: d.createdAt,
        });
      });
      setSummaries(sums);
    });

    return () => {
      unsubMessages();
      unsubSummaries();
    };
  }, [user, activeConvId]);

  // 4. Send Message via Cloud Function backend
  const handleSendMessage = async (prompt: string) => {
    if (!user) return;
    setError(null);
    setSending(true);

    try {
      // Create conversation ID if currently null
      const targetConvId = activeConvId || `journal_${Date.now()}`;
      if (!activeConvId) {
        setActiveConvId(targetConvId);
      }

      // Retrieve caller's Firebase Auth ID token
      const idToken = await user.getIdToken();
      const endpoint =
        process.env.NEXT_PUBLIC_CHAT_API_ENDPOINT || "/api/chatWithGemini";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          conversationId: targetConvId,
          prompt,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to reach Gemini backend");
      }
    } catch (err: any) {
      console.error("Chat communication error:", err);
      setError(err.message || "An error occurred communicating with Gemini.");
    } finally {
      setSending(false);
    }
  };

  const handleCreateNewConversation = () => {
    const newId = `journal_${Date.now()}`;
    setActiveConvId(newId);
    setMessages([]);
    setSummaries([]);
  };

  const handleDeleteConversation = async (convId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "conversations", convId));
      if (activeConvId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId);
        setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error("Delete conversation error:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-100">
        <p className="text-sm text-stone-500">Securing environment & validating token...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div id="dashboard-container" className="h-screen flex flex-col bg-stone-100 overflow-hidden">
      {/* Top App Bar */}
      <header className="h-14 bg-white border-b border-stone-200 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-stone-400 hover:text-stone-800 transition p-1 rounded-lg"
            title="Back to Landing Page"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-7 h-7 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-xs">
            G
          </div>
          <span className="font-semibold text-sm text-stone-900">Personal Gemini Journal</span>

          {/* User scope badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-2.5 py-0.5">
            <Shield className="w-3 h-3 text-emerald-600" />
            <span className="font-mono text-[10px]">user/{user.uid.slice(0, 8)}...</span>
          </div>
        </div>

        <div>
          <Auth user={user} loading={false} />
        </div>
      </header>

      {/* Main App Body: Sidebar + Chat Interface */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <HistoryList
          conversations={conversations}
          activeId={activeConvId}
          onSelect={(id) => setActiveConvId(id)}
          onNew={handleCreateNewConversation}
          onDelete={handleDeleteConversation}
          loading={false}
        />

        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <ChatInterface
            conversationId={activeConvId}
            messages={messages}
            summaries={summaries}
            onSendMessage={handleSendMessage}
            loading={sending}
            error={error}
          />
        </main>
      </div>
    </div>
  );
}
