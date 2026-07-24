/**
 * Firebase bootstrap — only initializes when env is fully valid.
 * Invalid/placeholder keys never reach the SDK (avoids WS auth with bad tokens).
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

function envStr(key: string): string {
  try {
    const raw = (import.meta.env as Record<string, unknown>)[key];
    if (raw == null) return '';
    return String(raw).trim();
  } catch {
    return '';
  }
}

function isValidConfigValue(v: string): boolean {
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower === 'undefined' || lower === 'null' || lower === 'nan') return false;
  if (
    lower === 'placeholder' ||
    lower.includes('your-project') ||
    lower.includes('xxxxxx') ||
    lower.includes('placeholder')
  ) {
    return false;
  }
  if (v.startsWith('@')) return false;
  return true;
}

const firebaseConfig = {
  apiKey: envStr('VITE_FIREBASE_API_KEY'),
  authDomain: envStr('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: envStr('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: envStr('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: envStr('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: envStr('VITE_FIREBASE_APP_ID'),
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let initError: string | null = null;
let disabled = false;

/** True only when every required field is a real non-placeholder value. */
export function isFirebaseConfigured(): boolean {
  if (disabled) return false;
  return (
    isValidConfigValue(firebaseConfig.apiKey) &&
    isValidConfigValue(firebaseConfig.authDomain) &&
    isValidConfigValue(firebaseConfig.projectId) &&
    isValidConfigValue(firebaseConfig.appId)
  );
}

export function getFirebaseInitError(): string | null {
  return initError;
}

/** Permanently fall back to local mode after a hard Firebase failure. */
export function disableFirebase(reason?: string): void {
  disabled = true;
  if (reason) initError = reason;
  console.warn('[YSI] Firebase disabled:', reason || 'unknown');
}

export function getFirebaseApp(): FirebaseApp {
  if (disabled || !isFirebaseConfigured()) {
    throw new Error(
      initError ||
        'Firebase is not configured. Set valid VITE_FIREBASE_* in .env.local'
    );
  }
  if (!app) {
    try {
      app = getApps().length
        ? getApps()[0]!
        : initializeApp({
            apiKey: firebaseConfig.apiKey,
            authDomain: firebaseConfig.authDomain,
            projectId: firebaseConfig.projectId,
            ...(isValidConfigValue(firebaseConfig.storageBucket)
              ? { storageBucket: firebaseConfig.storageBucket }
              : {}),
            ...(isValidConfigValue(firebaseConfig.messagingSenderId)
              ? { messagingSenderId: firebaseConfig.messagingSenderId }
              : {}),
            appId: firebaseConfig.appId,
          });
      initError = null;
    } catch (err) {
      initError = err instanceof Error ? err.message : 'Firebase init failed';
      disableFirebase(initError);
      throw err;
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getDb(): Firestore {
  if (!db) {
    const a = getFirebaseApp();
    try {
      // Long-polling avoids WebChannel/WebSocket token races
      db = initializeFirestore(a, {
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      db = getFirestore(a);
    }
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

export const MEMBERS_COLLECTION = 'members';
