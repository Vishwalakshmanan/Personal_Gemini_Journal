"use client";

/**
 * @file components/Auth.tsx
 * @description Google Sign-In and session control using Firebase Authentication SDK.
 */

import React, { useState } from "react";
import { signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { LogIn, LogOut, ShieldCheck, Loader2 } from "lucide-react";

interface AuthProps {
  user: User | null;
  loading: boolean;
}

export function Auth({ user, loading }: AuthProps) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState<boolean>(false);

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      setSigningIn(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in cancelled. Please complete sign-in in popup window.");
      } else if (err.code === "auth/network-request-failed") {
        setAuthError("Network error. Please check your internet connection.");
      } else {
        setAuthError("Failed to sign in. Please verify OAuth domain settings.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign Out Error:", err);
    }
  };

  if (loading) {
    return (
      <div id="auth-loading-state" className="flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
        <span>Verifying authentication session...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div id="auth-user-badge" className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-md rounded-full py-1.5 px-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User"}
              referrerPolicy="no-referrer"
              className="w-6 h-6 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs flex items-center justify-center font-bold">
              {user.displayName?.[0] || user.email?.[0] || "U"}
            </div>
          )}
          <span className="text-xs font-medium text-slate-200 max-w-[140px] truncate">
            {user.displayName || user.email}
          </span>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" title="Authenticated Session" />
        </div>
        <button
          id="sign-out-button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 py-1.5 px-3 rounded-xl backdrop-blur-md transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    );
  }

  return (
    <div id="auth-signin-container" className="flex flex-col items-start gap-2">
      <button
        id="google-signin-button"
        onClick={handleSignIn}
        disabled={signingIn}
        className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] font-bold text-xs uppercase tracking-wider text-white py-3 px-6 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-60"
      >
        {signingIn ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>Continue with Google</span>
      </button>

      {authError && (
        <p className="text-xs text-rose-400 font-medium mt-1">{authError}</p>
      )}
    </div>
  );
}
