"use client";

/**
 * @file components/HistoryList.tsx
 * @description Sidebar listing the last 10 isolated journal conversations for the authenticated user.
 */

import React from "react";
import { MessageSquare, Plus, Trash2, Calendar, Sparkles } from "lucide-react";

export interface ConversationItem {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  latestSummary?: string;
}

interface HistoryListProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

export function HistoryList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  loading,
}: HistoryListProps) {
  // Show strictly the last 10 conversations per requirements
  const recentConversations = conversations.slice(0, 10);

  return (
    <aside
      id="journal-history-sidebar"
      className="w-full md:w-72 lg:w-80 flex-shrink-0 bg-white/5 border-r border-white/10 backdrop-blur-xl flex flex-col h-full text-slate-200"
    >
      {/* Sidebar Header with New Journal Button */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">History</h2>
            <p className="text-[10px] text-slate-500">Isolated Sessions</p>
          </div>
        </div>
        <button
          id="new-journal-button"
          onClick={onNew}
          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {loading ? (
          <div className="p-4 text-center text-xs text-slate-500">Loading isolated entries...</div>
        ) : recentConversations.length === 0 ? (
          <div className="p-6 text-center text-slate-500 space-y-2 border border-dashed border-white/10 rounded-2xl m-2">
            <p className="text-xs">No journal sessions yet.</p>
            <p className="text-[11px] text-slate-500">Start a new conversation to brainstorm or reflect.</p>
          </div>
        ) : (
          recentConversations.map((conv) => {
            const isActive = conv.id === activeId;
            const formattedDate = new Date(conv.updatedAt || conv.createdAt).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" }
            );

            return (
              <div
                key={conv.id}
                id={`conversation-item-${conv.id}`}
                onClick={() => onSelect(conv.id)}
                className={`group relative flex flex-col p-3 rounded-xl text-left cursor-pointer transition-all border ${
                  isActive
                    ? "bg-white/10 border-white/10 text-white shadow-sm"
                    : "bg-transparent border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs font-medium line-clamp-1 flex-1 ${isActive ? "text-indigo-300 font-semibold" : "text-slate-300"}`}>
                    {conv.title || "Untitled Journal"}
                  </span>
                  <button
                    id={`delete-conv-${conv.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this isolated conversation?")) {
                        onDelete(conv.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-opacity"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {formattedDate}
                  </span>
                  <span>•</span>
                  <span>{conv.messageCount || 0} turns</span>
                  {conv.latestSummary && (
                    <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-medium ml-auto">
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

      {/* Security Status Box */}
      <div className="p-3 m-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
        <p className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Security Status
        </p>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Firestore rules enforced. request.auth.uid verified. Secrets managed by GCP.
        </p>
      </div>

      {/* Security isolation badge */}
      <div className="p-3 border-t border-white/10 bg-white/[0.02] text-[11px] text-slate-500 flex items-center justify-between">
        <span className="font-mono text-[10px] text-slate-500">Firestore Rules</span>
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold px-2 py-0.5 rounded-full text-[10px]">
          request.auth.uid
        </span>
      </div>
    </aside>
  );
}
