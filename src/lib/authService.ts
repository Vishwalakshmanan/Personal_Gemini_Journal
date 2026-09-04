import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./firebase";

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  role?: string;
  providerId?: string;
}

/**
 * Ensures user profile document exists in Firestore under /users/{uid}
 */
export async function syncUserProfile(user: FirebaseUser, customRole?: string): Promise<void> {
  const userRef = doc(db, "users", user.uid);
  try {
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || user.email?.split("@")[0] || "Journal Author",
        photoURL: user.photoURL || null,
        role: customRole || "Journalist",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await setDoc(
        userRef,
        {
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn("Could not sync user document to Firestore (continuing with auth session):", err);
  }
}

/**
 * Sign in or sign up using Google Popup
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await syncUserProfile(result.user);
    return result.user;
  } catch (error: any) {
    console.error("Google sign in error:", error);
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in cancelled: The Google sign-in window was closed before completion.");
    }
    if (error.code === "auth/popup-blocked") {
      throw new Error("Sign-in blocked: Your browser blocked the pop-up window. Please enable pop-ups for this site.");
    }
    throw new Error(error.message || "Failed to sign in with Google.");
  }
}

/**
 * Sign in using Email and Password
 */
export async function signInWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    await syncUserProfile(result.user);
    return result.user;
  } catch (error: any) {
    console.error("Email sign in error:", error);
    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      throw new Error("Invalid email or password. Please check your credentials or create an account.");
    }
    if (error.code === "auth/operation-not-allowed") {
      throw new Error("Email/Password provider is not yet enabled in your Firebase Console. Please use 'Continue with Google' or enable Email/Password in Firebase Console.");
    }
    if (error.code === "auth/too-many-requests") {
      throw new Error("Access temporarily disabled due to multiple failed login attempts. Please reset password or try again later.");
    }
    throw new Error(error.message || "Failed to sign in with email and password.");
  }
}

/**
 * Register a new account using Email and Password
 */
export async function signUpWithEmail(email: string, pass: string, name: string): Promise<FirebaseUser> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (name.trim()) {
      await updateProfile(result.user, {
        displayName: name.trim(),
      });
    }
    await syncUserProfile(result.user);
    return result.user;
  } catch (error: any) {
    console.error("Email registration error:", error);
    if (error.code === "auth/email-already-in-use") {
      throw new Error("An account already exists with this email address. Please sign in instead.");
    }
    if (error.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please choose a password with at least 6 characters.");
    }
    if (error.code === "auth/operation-not-allowed") {
      throw new Error("Email/Password provider is not yet enabled in your Firebase Console. Please use 'Continue with Google' or enable Email/Password in Firebase Console.");
    }
    throw new Error(error.message || "Failed to create an account.");
  }
}

/**
 * Sign out of current session
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error("Sign out error:", error);
    throw new Error(error.message || "Failed to sign out.");
  }
}
