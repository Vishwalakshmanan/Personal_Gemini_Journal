"use client";

/**
 * @file app/page.tsx
 * @description Next.js 14 Landing Page with Google Auth flow and security guarantees.
 */

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Auth } from "../components/Auth";
import { Shield, Lock, Brain, Database, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div id="landing-page-root" className="min-h-screen bg-stone-100/60 text-stone-900 flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="max-w-6xl w-full mx-auto p-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            G
          </div>
          <span className="font-bold tracking-tight text-stone-900 text-base">Personal Gemini Journal</span>
        </div>

        <div>
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 bg-stone-900 text-stone-50 hover:bg-stone-800 text-xs font-semibold py-2 px-4 rounded-xl shadow-sm transition"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Auth user={user} loading={loading} />
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-12 text-center space-y-8">
        <div className="inline-flex items-center gap-2 bg-stone-200/80 border border-stone-300 text-stone-800 px-3.5 py-1.5 rounded-full text-xs font-medium">
          <Shield className="w-3.5 h-3.5 text-emerald-700" />
          <span>OWASP Top 10 • Zero-Knowledge Cross-User Isolation</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-stone-900 leading-tight">
          Private, AI-Augmented Journaling with Complete Data Isolation.
        </h1>

        <p className="text-stone-600 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Reflect deeply, brainstorm freely, and explore your ideas with Gemini 1.5 Flash.
          Every interaction is protected by strict Firestore user boundaries and Secret Manager key security.
        </p>

        {/* Authentication CTA Card */}
        <div className="max-w-sm mx-auto bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-stone-800">Begin Your Private Session</h2>
          <div className="flex justify-center">
            {user ? (
              <Link
                href="/dashboard"
                className="w-full inline-flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-stone-800 transition"
              >
                <span>Enter Your Journal Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Auth user={user} loading={loading} />
            )}
          </div>
          <p className="text-[11px] text-stone-400">
            Protected via Google OAuth 2.0. No passwords stored.
          </p>
        </div>

        {/* Security Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-10 text-left">
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900">Per-User Data Isolation</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Every document is strictly scoped to <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px]">request.auth.uid</code>. Cross-user reading is blocked at the database engine.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Brain className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900">Automated Summarization</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Gemini automatically creates key insight checkpoints every 5 turns, distilling takeaways without cluttering history.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900">Secret Manager Key Storage</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              All Gemini API credentials live exclusively in Google Cloud Secret Manager. Zero client-side key leakage.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto p-6 border-t border-stone-200 text-stone-500 text-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>Personal Gemini Journal • Production Security Architecture</div>
        <div className="flex items-center gap-4 text-stone-400 text-xs">
          <span>OWASP Top 10 Compliant</span>
          <span>•</span>
          <span>Google Cloud Secret Manager</span>
          <span>•</span>
          <span>Firebase 2nd Gen Functions</span>
        </div>
      </footer>
    </div>
  );
}
