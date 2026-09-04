import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { Conversation, Message, SummaryCheckpoint } from "../App";

/**
 * Fetch all conversations for a specific authenticated user
 */
export async function fetchUserConversations(userId: string): Promise<Conversation[]> {
  const path = `users/${userId}/conversations`;
  try {
    const colRef = collection(db, "users", userId, "conversations");
    const q = query(colRef, orderBy("updatedAt", "desc"), limit(20));
    const snapshot = await getDocs(q);

    const conversations: Conversation[] = [];
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const convId = docSnap.id;

      // Fetch messages for this conversation
      let messages: Message[] = [];
      try {
        const msgColRef = collection(db, "users", userId, "conversations", convId, "messages");
        const msgQuery = query(msgColRef, orderBy("timestamp", "asc"), limit(50));
        const msgSnapshot = await getDocs(msgQuery);
        messages = msgSnapshot.docs.map((m) => {
          const mData = m.data();
          return {
            id: m.id,
            sender: mData.sender,
            text: mData.text,
            timestamp: mData.timestamp,
          };
        });
      } catch (err) {
        console.warn(`Could not load messages for conversation ${convId}:`, err);
      }

      // Fetch summaries for this conversation
      let summaries: SummaryCheckpoint[] = [];
      try {
        const sumColRef = collection(db, "users", userId, "conversations", convId, "summaries");
        const sumSnapshot = await getDocs(sumColRef);
        summaries = sumSnapshot.docs.map((s) => {
          const sData = s.data();
          return {
            id: s.id,
            conversationId: convId,
            summaryText: sData.summaryText,
            messageCheckpoint: sData.messageCheckpoint || 5,
            createdAt: sData.createdAt,
          };
        });
      } catch (err) {
        console.warn(`Could not load summaries for conversation ${convId}:`, err);
      }

      conversations.push({
        id: convId,
        userId: data.userId || userId,
        title: data.title || "Untitled Journal",
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        messageCount: data.messageCount || messages.length,
        messages,
        summaries,
      });
    }

    return conversations;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Save or update a conversation document
 */
export async function saveConversation(userId: string, conv: Conversation): Promise<void> {
  const path = `users/${userId}/conversations/${conv.id}`;
  try {
    const convRef = doc(db, "users", userId, "conversations", conv.id);
    await setDoc(
      convRef,
      {
        id: conv.id,
        userId,
        title: conv.title.slice(0, 200),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Save a message in a conversation subcollection
 */
export async function saveMessage(userId: string, convId: string, message: Message): Promise<void> {
  const path = `users/${userId}/conversations/${convId}/messages/${message.id}`;
  try {
    const msgRef = doc(db, "users", userId, "conversations", convId, "messages", message.id);
    await setDoc(msgRef, {
      sender: message.sender,
      text: message.text.slice(0, 10000),
      timestamp: message.timestamp,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Save a summary checkpoint in a conversation subcollection
 */
export async function saveSummary(userId: string, convId: string, summary: SummaryCheckpoint): Promise<void> {
  const path = `users/${userId}/conversations/${convId}/summaries/${summary.id}`;
  try {
    const sumRef = doc(db, "users", userId, "conversations", convId, "summaries", summary.id);
    await setDoc(sumRef, {
      conversationId: convId,
      summaryText: summary.summaryText,
      messageCheckpoint: summary.messageCheckpoint,
      createdAt: summary.createdAt,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Delete an entire conversation and its subcollections
 */
export async function deleteConversation(userId: string, convId: string): Promise<void> {
  const path = `users/${userId}/conversations/${convId}`;
  try {
    const convRef = doc(db, "users", userId, "conversations", convId);
    await deleteDoc(convRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
