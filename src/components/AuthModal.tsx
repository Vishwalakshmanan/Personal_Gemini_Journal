import React, { useState } from "react";
import {
  Lock,
  Mail,
  KeyRound,
  User,
  AlertCircle,
  X,
  Sparkles,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from "../lib/authService";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: "signin" | "signup";
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "signin",
}) => {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please fill in both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="auth-modal-card"
        className="relative w-full max-w-md rounded-2xl bg-slate-900/95 border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)",
        }}
      >
        {/* Close Button */}
        <button
          id="auth-modal-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {mode === "signin" ? "Sign In to Journal" : "Create Your Account"}
            </h2>
            <p className="text-xs text-slate-400">
              {mode === "signin"
                ? "Access your encrypted personal reflection archives"
                : "Begin your private, security-hardened journal"}
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 mb-6 rounded-xl bg-slate-800/80 border border-white/5">
          <button
            id="tab-signin-btn"
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "signin"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign In
          </button>
          <button
            id="tab-signup-btn"
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "signup"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          error.includes("OPERATION_NOT_ALLOWED") ? (
            <div
              id="auth-provider-notice"
              className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-300 text-xs">Email Provider Not Enabled in Firebase Console</p>
                  <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">
                    Firebase provisions Google Sign-In by default. <strong className="text-white">Continue with Google</strong> is active and ready to use immediately!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-2.5 px-3 rounded-lg bg-white text-slate-900 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-100 active:scale-[0.99] transition-all shadow-md disabled:opacity-50"
              >
                <span>👉 Continue with Google (Ready Now)</span>
              </button>
              <div className="text-[10px] text-slate-400 border-t border-amber-500/20 pt-2 space-y-1">
                <p className="font-medium text-slate-300">To enable Email & Password registration:</p>
                <p>1. Open your project in the <strong className="text-slate-200">Firebase Console</strong></p>
                <p>2. Go to <strong className="text-slate-200">Authentication → Sign-in method</strong></p>
                <p>3. Select <strong className="text-slate-200">Email/Password</strong> and toggle <strong className="text-slate-200">Enable</strong></p>
              </div>
            </div>
          ) : (
            <div
              id="auth-error-alert"
              className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )
        )}

        {/* One-Click Google Auth (Default & Preferred in AI Studio) */}
        <button
          id="google-signin-btn"
          type="button"
          disabled={loading}
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 active:scale-[0.99] transition-all shadow-md mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
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
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-sans tracking-normal">
            Ready to Use
          </span>
        </button>

        {/* Divider */}
        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-widest font-medium">
            or with email
          </span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="auth-name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="auth-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="auth-password-input"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-800/60 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : mode === "signin" ? (
              "Sign In with Email"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Security badge footer */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Isolated Subcollection Rules
          </span>
          <span className="text-slate-500">Firebase Auth</span>
        </div>
      </div>
    </div>
  );
};
