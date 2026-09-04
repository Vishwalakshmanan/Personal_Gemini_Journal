# Security Documentation & Threat Model: Personal Gemini Journal

## 1. Threat Model (OWASP Top 10 & AI Security)

### Threat 1: API Key Leakage / Credential Exposure
- **Attack Vector**: Hardcoding `GEMINI_API_KEY` in frontend bundles, GitHub repositories, or client-accessible environment variables (`NEXT_PUBLIC_*`).
- **Impact**: Critical compromise of API quota, potential denial-of-wallet, and unauthorized model execution.
- **Mitigation**: 
  - Absolute exclusion of the Gemini API key from the client bundle.
  - Deployment via **Google Cloud Secret Manager** mounted directly in Cloud Functions memory via `defineSecret('GEMINI_API_KEY')`.
  - Fallback client SDK retrieval using `@google-cloud/secret-manager` restricted to backend service accounts with minimal IAM roles (`roles/secretmanager.secretAccessor`).

### Threat 2: Broken Object Level Authorization (BOLA / IDOR)
- **Attack Vector**: Malicious actor authenticates as User A and submits requests querying or modifying `/users/{UserB_UID}/conversations/...`.
- **Impact**: Catastrophic cross-tenant data breach exposing private journals, therapeutic reflections, and brainstorming notes.
- **Mitigation**:
  - Cloud Firestore Security Rules enforce document isolation under `/users/{userId}/...` with `request.auth.uid == userId`.
  - Backend Cloud Function verifies Firebase Auth JWT tokens via `admin.auth().verifyIdToken()` and strictly pins all database queries to the verified `decodedToken.uid`.

### Threat 3: Prompt Injection & Denial of Service (DoS)
- **Attack Vector**: Attacker submits oversized strings (>10 MB) to exhaust memory, or crafted prompt injections designed to hijack the model's system prompt or extract system metadata.
- **Impact**: Server memory exhaustion, billing spikes, or behavioral manipulation of AI outputs.
- **Mitigation**:
  - Server-side input sanitization stripping ASCII control characters `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`.
  - Strict 8,000-character ceiling enforced before invoking `ai.models.generateContent()`.
  - System instructions with grounded instructions preventing role escape.

### Threat 4: Sensitive Data Exposure via Stack Traces
- **Attack Vector**: Triggering uncaught exceptions in server endpoints to inspect framework versions, file paths, and internal error stacks.
- **Impact**: Reconnaissance data leaked to potential adversaries.
- **Mitigation**:
  - Try/catch blocks around all asynchronous operations.
  - Server logs detailed stack traces internally using `console.error()`, returning only sanitized HTTP 400/401/500 messages to the client.

---

## 2. Pre-Production Security Checklist

- [ ] **Firestore Rules Audited**: Confirm `firestore.rules` has no `allow read, write: if true;` statements. Confirm fallback rule `match /{document=**} { allow read, write: if false; }` is in place.
- [ ] **Secret Manager Integration**: Verify that `GEMINI_API_KEY` is provisioned in Google Cloud Secret Manager and not stored in plaintext anywhere in the repository.
- [ ] **IAM Principle of Least Privilege**: Verify Cloud Functions runtime service account only holds `roles/secretmanager.secretAccessor` and `roles/datastore.user`.
- [ ] **CORS Domain Whitelisting**: Confirm `corsHandler` in `functions/src/index.ts` restricts origins exclusively to the production domain and authenticated local development domains.
- [ ] **Auth Token Verification**: Ensure all Cloud Function endpoints require a valid `Authorization: Bearer <ID_TOKEN>` header verified via Firebase Admin SDK.
- [ ] **Input Constraints**: Verify that client and server both enforce max string lengths and character sanitization.

---

## 3. Testing User Isolation with Multiple Accounts

To rigorously verify that User A cannot read, modify, or list User B's journal entries:

### Step 1: Create Test Accounts
1. Sign in with Account 1 (e.g., `alice@example.com`) on Browser Window 1.
2. In the journal dashboard, create a new conversation titled `"Alice Confidential Strategic Plan"`.
3. Send a message: `"Brainstorming confidential Q4 targets"`.
4. Note the generated Conversation ID from the URL or Firestore console.

### Step 2: Test Cross-User Access via Account 2
1. Open an Incognito window and sign in with Account 2 (e.g., `bob@example.com`).
2. Verify that Alice's conversation does **not** appear in Bob's History sidebar.
3. Open Developer Tools (Console) and run a direct Firestore query attempting to read Alice's conversation:
   ```javascript
   import { doc, getDoc } from "firebase/firestore";
   import { db } from "./lib/firebase";
   
   // Attempt cross-tenant read of Alice's document:
   const aliceDocRef = doc(db, "users", "ALICE_UID", "conversations", "ALICE_CONV_ID");
   getDoc(aliceDocRef).then(console.log).catch(console.error);
   ```
4. **Expected Outcome**: The promise will reject with `FirebaseError: Missing or insufficient permissions.`, confirming that Firestore Security Rules successfully blocked the access.

### Step 3: Test Cloud Function Injection via Account 2
1. In Bob's authenticated session, send a POST request to `/api/chatWithGemini`:
   ```bash
   curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/chatWithGemini \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer BOB_ID_TOKEN" \
     -d '{"conversationId": "ALICE_CONV_ID", "prompt": "Attempt cross-tenant write"}'
   ```
2. **Expected Outcome**: The Cloud Function writes exclusively to `/users/BOB_UID/conversations/ALICE_CONV_ID`, completely isolated from `/users/ALICE_UID/...`. Alice's data remains untouched and secure.

---

## 4. Google Cloud Secret Manager Deployment Instructions

Follow these step-by-step commands to configure Secret Manager in your Google Cloud Project:

### 1. Enable Required Google Cloud APIs
```bash
gcloud services enable \
  secretmanager.googleapis.com \
  cloudfunctions.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com
```

### 2. Create and Populate the Secret
```bash
# Create the secret container
gcloud secrets create GEMINI_API_KEY \
  --replication-policy="automatic" \
  --project="personal-gemini-journal-prod"

# Add the API key version
echo -n "AIzaSyYourActualGeminiApiKeyHere" | \
  gcloud secrets versions add GEMINI_API_KEY \
  --data-file=- \
  --project="personal-gemini-journal-prod"
```

### 3. Grant Access to Cloud Functions Runtime Service Account
```bash
PROJECT_NUMBER=$(gcloud projects describe personal-gemini-journal-prod --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project="personal-gemini-journal-prod"
```

### 4. Deploy Cloud Functions and Firestore Rules
```bash
# Deploy Firestore security rules
firebase deploy --only firestore:rules

# Deploy Cloud Functions (Secret is automatically bound via defineSecret)
firebase deploy --only functions
```
