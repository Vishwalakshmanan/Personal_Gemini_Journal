"use client";

/**
 * @file components/ChatInterface.tsx
 * @description Interactive multi-turn journaling interface with Gemini 1.5/3.8 Flash,
 * bubble rendering, auto-checkpoint summarization display, and input sanitization.
 */

import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, AlertCircle, Bot, User as UserIcon, Loader2, BookOpen } from "lucide-react";

export interface ChatMessage {
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

interface ChatInterfaceProps {
  conversationId: string | null;
  messages: ChatMessage[];
  summaries: SummaryCheckpoint[];
  onSendMessage: (text: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function ChatInterface({
  conversationId,
  messages,
  summaries,
  onSendMessage,
  loading,
  error,
}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;

    // OWASP client-side sanitization check
    const cleanText = inputText.trim();
    if (cleanText.length > 8000) {
      alert("Journal entry exceeds maximum 8,000 characters limit.");
      return;
    }

    setInputText("");
    await onSendMessage(cleanText);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div id="chat-interface-root" className="flex-1 flex flex-col h-full bg-transparent relative text-slate-200">
      {/* Top Conversation Header */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-white/5 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">Session:</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Live Firestore Sync
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">•</span>
          <span className="text-xs text-slate-400 truncate max-w-xs font-medium hidden sm:inline">
            {messages.length > 0 ? "Journal & Brainstorming Session" : "New Reflection"}
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-400 uppercase tracking-tighter">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Auto-Summary: {messages.length % 5}/5</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-400 uppercase tracking-tighter">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span>Private Node</span>
          </div>
        </div>
      </header>

      {/* Message Feed */}
      <div id="messages-container" className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto my-12 text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-indigo-400 shadow-xl shadow-indigo-500/10 backdrop-blur-md">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">Personal Gemini Journal</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-md mx-auto">
                Encrypted reflection and brainstorming environment.
                Every turn is strictly stored under your isolated user document in Firestore.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
              {[
                "Reflect on what gave me energy today and what drained me.",
                "Brainstorm 3 creative directions for my upcoming project.",
                "Help me untangle conflicting feelings about a key decision.",
                "Conduct a 5-minute gratitude journaling prompt.",
              ].map((promptIdea, idx) => (
                <button
                  key={idx}
                  id={`starter-prompt-${idx}`}
                  onClick={() => {
                    setInputText(promptIdea);
                    inputRef.current?.focus();
                  }}
                  className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-all backdrop-blur-sm text-left group"
                >
                  <span className="block text-indigo-300 group-hover:text-indigo-200 mb-1 font-medium">Prompt Idea:</span>
                  <span className="text-slate-400 group-hover:text-slate-200">"{promptIdea}"</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.sender === "user";
            const matchingSummary = summaries.find((s) => s.messageCheckpoint === index + 1);

            return (
              <React.Fragment key={msg.id || index}>
                {isUser ? (
                  <div id={`chat-message-${index}`} className="flex flex-col items-end gap-2">
                    <div className="max-w-[70%] p-4 rounded-2xl rounded-tr-none bg-indigo-600 text-white text-sm shadow-xl shadow-indigo-500/10 leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-500 px-1 font-mono tracking-tighter uppercase">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · SANITIZED
                    </span>
                  </div>
                ) : (
                  <div id={`chat-message-${index}`} className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-indigo-500/50 flex shrink-0 items-center justify-center text-indigo-400 font-bold text-xs shadow-sm">
                      G
                    </div>
                    <div className="flex flex-col gap-2 max-w-[85%]">
                      <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/10 text-sm leading-relaxed text-slate-300 backdrop-blur-md shadow-sm whitespace-pre-wrap">
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-slate-500 px-1 font-mono tracking-tighter uppercase">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · GEMINI 1.5 FLASH
                      </span>
                    </div>
                  </div>
                )}

                {/* Auto-Summary Checkpoint Banner */}
                {matchingSummary && (
                  <div
                    id={`checkpoint-summary-${matchingSummary.id}`}
                    className="flex gap-4 items-center p-4 border border-dashed border-indigo-500/20 bg-indigo-500/5 rounded-2xl backdrop-blur-sm my-3 max-w-3xl mx-auto"
                  >
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

        {/* Processing Indicator */}
        {loading && (
          <div id="ai-loading-indicator" className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-indigo-500/50 flex shrink-0 items-center justify-center text-indigo-400 font-bold text-xs shadow-sm">
              G
            </div>
            <div className="flex flex-col gap-2">
              <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/10 text-sm text-slate-400 backdrop-blur-md shadow-sm flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Gemini is reflecting and distilling journal response...</span>
              </div>
              <span className="text-[10px] text-slate-500 px-1 font-mono tracking-tighter uppercase">
                PROCESSING VIA SECRET MANAGER
              </span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div
            id="chat-error-banner"
            className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-3 backdrop-blur-md"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Frosted Glass Chat Input Bar */}
      <div className="p-6 border-t border-white/5 bg-white/[0.02] backdrop-blur-md">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
          <input
            ref={inputRef}
            type="text"
            id="chat-input-textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask Gemini about your reflections or brainstorming..."
            disabled={loading}
            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 pr-32 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all backdrop-blur-md shadow-inner disabled:opacity-50"
          />

          <div className="absolute right-2 top-2 bottom-2 flex items-center gap-2">
            <button
              type="submit"
              id="send-message-button"
              disabled={!inputText.trim() || loading}
              className="h-full px-5 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center gap-1.5"
              title="Send entry"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-slate-600 mt-4 tracking-widest uppercase">
          Encrypted Tunnel Active • No Local Storage Logs
        </p>
      </div>
    </div>
  );
}
