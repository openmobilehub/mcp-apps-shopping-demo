import { applicationDefault, cert, getApps, initializeApp, type AppOptions, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Lazy, single-init Admin SDK. Credentials come from env vars / a key file so
// nothing is committed. Imported only by catalog-store's defaultLoader and the
// seed script, so unit tests that inject a loader never load this module.
let app: App | undefined;

// Resolve credentials from one of two sources, in order:
//  1. Explicit service-account env vars (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL
//     / FIREBASE_PRIVATE_KEY) — handy for Vercel, where the key's newlines are
//     stored escaped as "\n".
//  2. GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON file — the
//     idiomatic Firebase Admin default (projectId is read from the key). Easiest
//     for local seeding: download the key and point this var at it.
function appOptions(): AppOptions {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return { credential: cert({ projectId, clientEmail, privateKey }) };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { credential: applicationDefault() };
  }
  throw new Error(
    "Firebase credentials missing — set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, " +
      "or GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON file.",
  );
}

export function getDb(): Firestore {
  if (!app) {
    app = getApps()[0] ?? initializeApp(appOptions());
  }
  return getFirestore(app);
}
