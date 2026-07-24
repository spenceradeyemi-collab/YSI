/**
 * Member persistence + auth layer.
 *
 * Firebase mode: Auth + Firestore + Storage (when VITE_FIREBASE_* is valid).
 * Local mode: localStorage fallback.
 *
 * Guards:
 * - Never open Firestore listeners without a real Auth ID token
 *   (prevents WebSocket "undefined token" failures).
 * - Always normalize member/session shapes to avoid null crashes.
 * - Dev tools only via canShowDevTools().
 */

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Unsubscribe,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

import { Member, MemberStatus, Permission, AdminRole } from '../types';
import { STORAGE_KEYS } from './geminiService';
import {
  getDb,
  getFirebaseAuth,
  getFirebaseStorage,
  isFirebaseConfigured,
  MEMBERS_COLLECTION,
} from './firebase';

const MAX_PHOTO_DIMENSION = 720;
const JPEG_QUALITY = 0.72;
const MAX_INLINE_PHOTO_CHARS = 700_000;
/** Keep base64 photos out of the shared registry JSON (quota + wipe risk). */
const PHOTO_KEY_PREFIX = 'ysi_photo_';
const USERS_BACKUP_KEY = 'ysi_users_bak';
/** Fired whenever the member registry changes (same-tab admin refresh). */
export const MEMBERS_UPDATED_EVENT = 'ysi_members_updated';

const SUPER_PERMISSIONS: Permission[] = [
  'CREATE_POST',
  'EDIT_POST',
  'DELETE_POST',
  'LIKE_POST',
  'COMMENT_POST',
  'APPROVE_MEMBER',
  'MANAGE_FINANCES',
  'VIEW_LOGS',
  'ASSIGN_ROLES',
  'registry_access',
  'moderation_access',
  'treasury_access',
  'attendance_access',
  'directory_access',
  'system_access',
  'logs_access',
  'master_access',
];

const VALID_STATUSES: MemberStatus[] = ['pending', 'intending', 'active', 'rejected'];

// ─── Utilities ───────────────────────────────────────────────────────────────

export function createMemberId(): string {
  return `ysi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createMemberNumber(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `YSI-${new Date().getFullYear()}-${n}`;
}

/** Dev tools: only in DEV builds or for admin users — never normal production members. */
export function canShowDevTools(user?: Member | null): boolean {
  if (import.meta.env.DEV) return true;
  if (!user) return false;
  if (user.isAdmin === true) return true;
  if (user.adminRole === 'SUPER' || user.adminRole === 'ADMIN') return true;
  return false;
}

export function isUsingFirebase(): boolean {
  try {
    return isFirebaseConfigured();
  } catch {
    return false;
  }
}

/** Normalize any partial/corrupt object into a safe Member (never null fields that crash UI). */
export function normalizeMember(raw: unknown, fallbackId = ''): Member | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;

  const id = String(d.id ?? fallbackId ?? '').trim();
  const email = String(d.email ?? '').trim().toLowerCase();
  if (!id && !email) return null;

  let status = (d.status as MemberStatus) || 'pending';
  if (!VALID_STATUSES.includes(status)) status = 'pending';

  const adminRole = (d.adminRole as AdminRole) ?? null;
  const permissions = Array.isArray(d.permissions)
    ? (d.permissions as Permission[])
    : (['CREATE_POST', 'LIKE_POST', 'COMMENT_POST'] as Permission[]);

  return {
    id: id || `tmp_${email || 'unknown'}`,
    memberId: String(d.memberId || id || createMemberNumber()),
    name: String(d.name || email.split('@')[0] || 'Member'),
    email: email || 'unknown@local',
    status,
    isAdmin: Boolean(d.isAdmin),
    adminRole,
    permissions,
    tribe: d.tribe != null ? String(d.tribe) : undefined,
    profession: d.profession != null ? String(d.profession) : undefined,
    role: String(d.role || (d.isAdmin ? 'ADMIN' : 'MEMBER')),
    bio: d.bio != null ? String(d.bio) : undefined,
    photoUrl: d.photoUrl != null ? String(d.photoUrl) : undefined,
    photoSettings: (d.photoSettings as Member['photoSettings']) || undefined,
    isPaidMember: Boolean(d.isPaidMember),
    paymentHistory: Array.isArray(d.paymentHistory)
      ? (d.paymentHistory as Member['paymentHistory'])
      : [],
    dues: d.dues && typeof d.dues === 'object' ? (d.dues as Member['dues']) : {},
    onboardingComplete: Boolean(d.onboardingComplete),
    lastPasswordReset:
      typeof d.lastPasswordReset === 'number' ? d.lastPasswordReset : undefined,
    birthday: String(d.birthday ?? ''),
    joinDate: typeof d.joinDate === 'number' ? d.joinDate : Date.now(),
    lastActive: typeof d.lastActive === 'number' ? d.lastActive : Date.now(),
  };
}

export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Image is too large. Please choose a photo under 12MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the image.'));
      img.onload = () => {
        try {
          let { width, height } = img;
          const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Image processing unavailable on this device.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Image compression failed.'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function stripPassword(member: Member): Member {
  const { password: _p, ...rest } = member as Member & { password?: string };
  return rest as Member;
}

function sanitizeForFirestore(member: Member): Record<string, unknown> {
  const clean = stripPassword(member);
  const data: Record<string, unknown> = { ...clean };
  if (
    typeof data.photoUrl === 'string' &&
    data.photoUrl.startsWith('data:') &&
    data.photoUrl.length > MAX_INLINE_PHOTO_CHARS
  ) {
    delete data.photoUrl;
  }
  Object.keys(data).forEach((k) => {
    if (data[k] === undefined) delete data[k];
  });
  return data;
}

function memberFromFirestore(id: string, data: Record<string, unknown>): Member {
  return (
    normalizeMember({ ...data, id }, id) ||
    defaultPendingMember({ id, email: String(data.email || ''), name: String(data.name || 'Member') })
  );
}

function defaultPendingMember(partial: {
  id: string;
  email: string;
  name: string;
}): Member {
  return {
    id: partial.id,
    memberId: createMemberNumber(),
    name: partial.name || 'Member',
    email: (partial.email || '').trim().toLowerCase() || 'unknown@local',
    status: 'pending',
    isAdmin: false,
    adminRole: null,
    permissions: ['CREATE_POST', 'LIKE_POST', 'COMMENT_POST'],
    role: 'MEMBER',
    isPaidMember: false,
    paymentHistory: [],
    dues: {},
    onboardingComplete: false,
    birthday: '',
    joinDate: Date.now(),
    lastActive: Date.now(),
  };
}

// ─── Session cache ───────────────────────────────────────────────────────────

export function persistSessionUser(user: Member | null | undefined, remember: boolean): void {
  const safe = normalizeMember(user);
  if (!safe) return;
  const payload = JSON.stringify(stripPassword(safe));
  try {
    if (remember || localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, payload);
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, payload);
    }
  } catch (err) {
    console.warn('persistSessionUser failed', err);
  }
}

export function clearSessionUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  } catch {
    /* ignore */
  }
}

export function getCachedSessionUser(): Member | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.CURRENT_USER) ||
      sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return null;
    return normalizeMember(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ─── Auth token gate (prevents Firestore WS with undefined token) ────────────

/**
 * Returns a valid Firebase ID token, or null if unauthenticated / misconfigured.
 * Call before any Firestore listen/read that would open a WebChannel/WebSocket.
 */
export async function ensureAuthToken(forceRefresh = false): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken(forceRefresh);
    if (!token || token === 'undefined' || token === 'null') return null;
    return token;
  } catch (err) {
    console.warn('ensureAuthToken failed', err);
    return null;
  }
}

async function withAuthToken<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isFirebaseConfigured()) return fn();
  const token = await ensureAuthToken();
  if (!token) {
    console.warn('Skipping Firebase op: no auth token');
    return fallback;
  }
  try {
    return await fn();
  } catch (err) {
    console.warn('Firebase op failed', err);
    return fallback;
  }
}

// ─── localStorage backend (shared registry for admin queue) ──────────────────

function notifyMembersUpdated(): void {
  try {
    window.dispatchEvent(
      new CustomEvent(MEMBERS_UPDATED_EVENT, { detail: { at: Date.now() } })
    );
  } catch {
    /* SSR / non-browser */
  }
}

function photoStorageKey(id: string): string {
  return `${PHOTO_KEY_PREFIX}${id}`;
}

/** Persist large data-URL photos under a dedicated key so ysi_users stays small. */
function externalizePhoto(member: Member): Member {
  const url = member.photoUrl;
  if (!url || !member.id) return member;
  if (!url.startsWith('data:') || url.length < 2000) return member;
  try {
    localStorage.setItem(photoStorageKey(member.id), url);
    return { ...member, photoUrl: `local-photo:${member.id}` };
  } catch (err) {
    console.warn('Could not store profile photo separately', err);
    // Drop photo from registry entry rather than failing the whole application
    return { ...member, photoUrl: undefined };
  }
}

function hydratePhoto(member: Member): Member {
  const url = member.photoUrl;
  if (!url) return member;
  if (url.startsWith('local-photo:')) {
    const id = url.slice('local-photo:'.length) || member.id;
    try {
      const stored = localStorage.getItem(photoStorageKey(id));
      if (stored) return { ...member, photoUrl: stored };
    } catch {
      /* ignore */
    }
    return { ...member, photoUrl: undefined };
  }
  return member;
}

function parseUsersRaw(raw: string | null): Member[] {
  if (!raw) return [];
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) return [];
  return arr
    .map((m) => normalizeMember(m))
    .filter(Boolean)
    .map((m) => hydratePhoto(m as Member)) as Member[];
}

function localGetAll(): Member[] {
  try {
    return parseUsersRaw(localStorage.getItem(STORAGE_KEYS.USERS));
  } catch (err) {
    console.error('Primary registry corrupt — trying backup', err);
    try {
      const recovered = parseUsersRaw(localStorage.getItem(USERS_BACKUP_KEY));
      if (recovered.length) {
        try {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(recovered.map(compactMember)));
        } catch {
          /* ignore */
        }
        return recovered.map(hydratePhoto);
      }
    } catch {
      /* ignore */
    }
    return [];
  }
}

/** Registry row without huge fields — safe for localStorage JSON. */
function compactMember(member: Member): Member {
  const externalized = externalizePhoto(stripPassword(member));
  return {
    ...externalized,
    // never keep plaintext password in registry blob if present
    password: undefined,
  } as Member;
}

function localSaveAll(members: Member[]): void {
  const compact = members.map((m) => compactMember(m));
  const json = JSON.stringify(compact.map(stripPassword));

  try {
    const prev = localStorage.getItem(STORAGE_KEYS.USERS);
    if (prev) {
      try {
        localStorage.setItem(USERS_BACKUP_KEY, prev);
      } catch {
        /* ignore backup failure */
      }
    }
    localStorage.setItem(STORAGE_KEYS.USERS, json);
  } catch (err) {
    console.warn('Registry save failed (quota?) — retrying without photos', err);
    const stripped = compact.map((m) => ({ ...m, photoUrl: undefined }));
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(stripped));
    } catch (err2) {
      console.error('Registry save failed completely', err2);
      throw new Error(
        'Could not save member registry (storage full). Clear site data and try again.'
      );
    }
  }
  notifyMembersUpdated();
}

function localUpsert(member: Member): Member {
  const base = normalizeMember(member);
  if (!base) throw new Error('Invalid member profile.');

  // Keep full photo on the returned object for the current user session
  const fullPhoto = base.photoUrl;
  const next = stripPassword({ ...base, lastActive: Date.now() });

  const members = localGetAll().map((m) => {
    // de-hydrate others for merge without re-loading every photo into memory thrice
    if (m.photoUrl?.startsWith('data:') && m.photoUrl.length > 2000) {
      return externalizePhoto(m);
    }
    return m;
  });

  // Work with compact list for write
  const compactList = members.map((m) => compactMember(m));
  const stored = compactMember(next);
  const idx = compactList.findIndex((m) => m.id === stored.id || m.email === stored.email);
  if (idx >= 0) {
    // Preserve id stability if email match
    stored.id = compactList[idx]!.id || stored.id;
    compactList[idx] = { ...compactList[idx], ...stored, id: stored.id };
  } else {
    compactList.push(stored);
  }

  localSaveAll(compactList);

  // Return hydrated member for UI (with real photo if we have it)
  const out = { ...next, id: stored.id };
  if (fullPhoto?.startsWith('data:')) {
    try {
      localStorage.setItem(photoStorageKey(out.id), fullPhoto);
    } catch {
      /* already handled in externalize */
    }
    return { ...out, photoUrl: fullPhoto };
  }
  return hydratePhoto(out);
}

/**
 * Submit membership application → status intending + registry write.
 * Guarantees the admin queue can see the applicant.
 */
export async function submitMembershipApplication(
  user: Member,
  fields: {
    name: string;
    tribe: string;
    profession?: string;
    bio?: string;
    birthday: string;
    photoUrl: string;
  }
): Promise<Member> {
  const updated: Member = {
    ...user,
    name: fields.name.trim(),
    tribe: fields.tribe.trim(),
    profession: fields.profession?.trim() || undefined,
    bio: fields.bio?.trim() || undefined,
    birthday: fields.birthday,
    photoUrl: fields.photoUrl,
    status: 'intending',
    onboardingComplete: true,
    lastActive: Date.now(),
  };

  const saved = await upsertMember(updated);
  // Belt-and-suspenders: always mirror into local registry for admin queue
  const mirrored = localUpsert(saved);
  persistSessionUser(mirrored, true);
  notifyMembersUpdated();
  return mirrored;
}

// ─── Firebase photo upload ───────────────────────────────────────────────────

async function uploadProfilePhoto(uid: string, dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  const token = await ensureAuthToken();
  if (!token) throw new Error('Not authenticated — cannot upload photo.');
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, `members/${uid}/profile.jpg`);
  await uploadString(storageRef, dataUrl, 'data_url', {
    contentType: 'image/jpeg',
    cacheControl: 'public,max-age=3600',
  });
  return getDownloadURL(storageRef);
}

// ─── Public read/write API ───────────────────────────────────────────────────

/**
 * Full member registry for Admin Dashboard.
 * Always merges localStorage registry so applications never “vanish”
 * when Firestore list rules fail or Firebase is misconfigured.
 */
export async function getAllMembers(): Promise<Member[]> {
  const local = localGetAll();
  const byId = new Map<string, Member>();
  for (const m of local) {
    if (m?.id) byId.set(m.id, m);
  }
  // Also index by email for merge
  const byEmail = new Map<string, Member>();
  for (const m of local) {
    if (m?.email) byEmail.set(m.email.toLowerCase(), m);
  }

  if (isFirebaseConfigured()) {
    try {
      const remote = await withAuthToken(async () => {
        const snap = await getDocs(collection(getDb(), MEMBERS_COLLECTION));
        return snap.docs.map((d) =>
          memberFromFirestore(d.id, d.data() as Record<string, unknown>)
        );
      }, [] as Member[]);

      for (const m of remote) {
        if (!m?.id) continue;
        const prev = byId.get(m.id) || byEmail.get(m.email?.toLowerCase() || '');
        // Prefer newer lastActive; keep local photo if remote lacks one
        if (!prev) {
          byId.set(m.id, m);
        } else {
          const newer =
            (m.lastActive || 0) >= (prev.lastActive || 0)
              ? { ...prev, ...m, photoUrl: m.photoUrl || prev.photoUrl }
              : { ...m, ...prev, photoUrl: prev.photoUrl || m.photoUrl };
          byId.set(newer.id, newer);
        }
      }
    } catch (err) {
      console.warn('getAllMembers remote failed — using local registry', err);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => (b.lastActive || 0) - (a.lastActive || 0)
  );
}

/**
 * Live registry for Admin Dashboard (poll + same-tab + cross-tab events).
 */
export function subscribeToMembersRegistry(
  callback: (members: Member[]) => void
): () => void {
  let cancelled = false;

  const emit = async () => {
    if (cancelled) return;
    try {
      const all = await getAllMembers();
      if (!cancelled) callback(all);
    } catch (err) {
      console.error('subscribeToMembersRegistry', err);
      if (!cancelled) callback(localGetAll());
    }
  };

  void emit();
  const interval = window.setInterval(() => void emit(), 2500);
  const onLocal = () => void emit();
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEYS.USERS ||
      e.key === USERS_BACKUP_KEY ||
      e.key === null ||
      (e.key && e.key.startsWith(PHOTO_KEY_PREFIX))
    ) {
      void emit();
    }
  };

  window.addEventListener(MEMBERS_UPDATED_EVENT, onLocal);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onLocal);

  return () => {
    cancelled = true;
    window.clearInterval(interval);
    window.removeEventListener(MEMBERS_UPDATED_EVENT, onLocal);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', onLocal);
  };
}

export async function getMemberById(id: string): Promise<Member | null> {
  if (!id) return null;
  if (!isFirebaseConfigured()) {
    return localGetAll().find((m) => m.id === id) ?? null;
  }

  return withAuthToken(async () => {
    const snap = await getDoc(doc(getDb(), MEMBERS_COLLECTION, id));
    if (!snap.exists()) return null;
    return memberFromFirestore(snap.id, snap.data() as Record<string, unknown>);
  }, localGetAll().find((m) => m.id === id) ?? null);
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  if (!isFirebaseConfigured()) {
    return localGetAll().find((m) => m.email.toLowerCase() === normalized) ?? null;
  }

  return withAuthToken(async () => {
    const q = query(
      collection(getDb(), MEMBERS_COLLECTION),
      where('email', '==', normalized),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0]!;
    return memberFromFirestore(d.id, d.data() as Record<string, unknown>);
  }, localGetAll().find((m) => m.email.toLowerCase() === normalized) ?? null);
}

export async function upsertMember(member: Member): Promise<Member> {
  const base = normalizeMember(member);
  if (!base) throw new Error('Invalid member profile.');
  let next: Member = stripPassword({ ...base, lastActive: Date.now() });

  if (!isFirebaseConfigured()) {
    return localUpsert(next);
  }

  const token = await ensureAuthToken();
  if (!token) {
    // Offline / no token: still persist locally so UI doesn't blank
    const local = localUpsert(next);
    console.warn('upsertMember: no auth token — saved locally only');
    return local;
  }

  const inlinePhoto = next.photoUrl;
  if (inlinePhoto?.startsWith('data:')) {
    try {
      next = { ...next, photoUrl: await uploadProfilePhoto(next.id, inlinePhoto) };
    } catch (err) {
      console.warn('Profile photo Storage upload failed', err);
      if (inlinePhoto.length > MAX_INLINE_PHOTO_CHARS) {
        throw new Error(
          'Photo upload to Storage failed. Enable Storage or use a smaller image.'
        );
      }
    }
  }

  try {
    await setDoc(doc(getDb(), MEMBERS_COLLECTION, next.id), sanitizeForFirestore(next), {
      merge: true,
    });
    // Mirror locally for offline recovery
    localUpsert(next);
    return next;
  } catch (err) {
    console.error('Firestore upsert failed, using local mirror', err);
    return localUpsert(next);
  }
}

export async function updateMemberStatus(
  id: string,
  status: MemberStatus
): Promise<Member | null> {
  if (!id || !VALID_STATUSES.includes(status)) return null;
  const member = await getMemberById(id);
  if (!member) {
    // try local
    const local = localGetAll().find((m) => m.id === id);
    if (!local) return null;
    return localUpsert({
      ...local,
      status,
      isPaidMember: status === 'active' ? true : local.isPaidMember,
    });
  }

  const next: Member = {
    ...member,
    status,
    isPaidMember: status === 'active' ? true : member.isPaidMember,
    lastActive: Date.now(),
  };

  if (!isFirebaseConfigured()) return localUpsert(next);

  const token = await ensureAuthToken();
  if (!token) return localUpsert(next);

  try {
    await updateDoc(doc(getDb(), MEMBERS_COLLECTION, id), {
      status,
      isPaidMember: next.isPaidMember,
      lastActive: next.lastActive,
    });
    localUpsert(next);
    return next;
  } catch (err) {
    console.error('updateMemberStatus failed', err);
    // Local update so admin flow still works in local/dev
    return localUpsert(next);
  }
}

// ─── Auth API ────────────────────────────────────────────────────────────────

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please log in.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/invalid-api-key':
      return 'Firebase API key is invalid. Check VITE_FIREBASE_API_KEY.';
    case 'auth/configuration-not-found':
      return 'Firebase Auth is not enabled for this project.';
    default:
      if (err instanceof Error && err.message) return err.message;
      return 'Authentication failed. Please try again.';
  }
}

async function applyAuthPersistence(remember: boolean): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    await setPersistence(
      getFirebaseAuth(),
      remember ? browserLocalPersistence : browserSessionPersistence
    );
  } catch (err) {
    console.warn('setPersistence failed', err);
  }
}

export async function registerMember(
  name: string,
  email: string,
  password: string,
  remember = true
): Promise<Member> {
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!trimmedName) throw new Error('Please enter your full name.');
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  if (!isFirebaseConfigured()) {
    if (await getMemberByEmail(normalizedEmail)) {
      throw new Error('An account with this email already exists. Please log in.');
    }
    const member = defaultPendingMember({
      id: createMemberId(),
      email: normalizedEmail,
      name: trimmedName,
    });
    const saved = localUpsert({ ...member, password } as Member);
    persistSessionUser(saved, remember);
    return stripPassword(saved);
  }

  try {
    await applyAuthPersistence(remember);
    const cred = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      normalizedEmail,
      password
    );
    // Force token so subsequent Firestore writes never use undefined token
    await cred.user.getIdToken(true);
    await updateProfile(cred.user, { displayName: trimmedName });

    const member = defaultPendingMember({
      id: cred.user.uid,
      email: normalizedEmail,
      name: trimmedName,
    });
    const saved = await upsertMember(member);
    persistSessionUser(saved, remember);
    return saved;
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

export async function loginMember(
  email: string,
  password: string,
  remember = true
): Promise<Member> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Please enter your email.');

  if (!isFirebaseConfigured()) {
    const existing = await getMemberByEmail(normalizedEmail);
    if (!existing) {
      throw new Error('No account found for that email. Please register.');
    }
    const withPass = localGetAll().find((m) => m.id === existing.id) as
      | (Member & { password?: string })
      | undefined;
    if (withPass?.password && withPass.password !== password) {
      throw new Error('Incorrect password.');
    }
    const refreshed = localUpsert({ ...existing, lastActive: Date.now() });
    persistSessionUser(refreshed, remember);
    return stripPassword(refreshed);
  }

  try {
    await applyAuthPersistence(remember);
    const cred = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      normalizedEmail,
      password
    );
    await cred.user.getIdToken(true);

    let member = await getMemberById(cred.user.uid);
    if (!member) {
      member = defaultPendingMember({
        id: cred.user.uid,
        email: normalizedEmail,
        name: cred.user.displayName || normalizedEmail.split('@')[0] || 'Member',
      });
      member = await upsertMember(member);
    } else {
      member = await upsertMember({ ...member, lastActive: Date.now() });
    }
    persistSessionUser(member, remember);
    return member;
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

export async function logoutMember(): Promise<void> {
  clearSessionUser();
  if (isFirebaseConfigured()) {
    try {
      await signOut(getFirebaseAuth());
    } catch (err) {
      console.warn('Firebase signOut failed', err);
    }
  }
}

export async function ensureVizierAdmin(): Promise<Member> {
  const email = (
    import.meta.env.VITE_VIZIER_EMAIL || 'vizier@ysi.local'
  ).toLowerCase();
  const password = import.meta.env.VITE_VIZIER_PASSWORD || 'vizier-dev-only';

  const adminFields = {
    name: 'Imperial Vizier',
    isAdmin: true as const,
    adminRole: 'SUPER' as const,
    status: 'active' as MemberStatus,
    permissions: SUPER_PERMISSIONS,
    role: 'SUPER',
    isPaidMember: true,
    onboardingComplete: true,
    tribe: 'Oyo',
    profession: 'Custodian',
    bio: 'Dev / admin gateway account.',
    birthday: '1970-01-01',
  };

  if (!isFirebaseConfigured()) {
    const existing = await getMemberByEmail(email);
    if (existing) {
      const admin = localUpsert({
        ...existing,
        ...adminFields,
        password,
      } as Member);
      persistSessionUser(admin, true);
      return stripPassword(admin);
    }
    const admin = localUpsert({
      id: createMemberId(),
      memberId: 'YSI-VIZIER-001',
      email,
      password,
      paymentHistory: [],
      dues: {},
      joinDate: Date.now(),
      lastActive: Date.now(),
      ...adminFields,
    } as Member);
    persistSessionUser(admin, true);
    return stripPassword(admin);
  }

  try {
    await applyAuthPersistence(true);
    let uid: string;
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      await cred.user.getIdToken(true);
      uid = cred.user.uid;
    } catch {
      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password
      );
      await cred.user.getIdToken(true);
      await updateProfile(cred.user, { displayName: adminFields.name });
      uid = cred.user.uid;
    }

    const existing = await getMemberById(uid);
    const admin: Member = {
      id: uid,
      memberId: existing?.memberId || 'YSI-VIZIER-001',
      email,
      paymentHistory: existing?.paymentHistory || [],
      dues: existing?.dues || {},
      joinDate: existing?.joinDate || Date.now(),
      lastActive: Date.now(),
      photoUrl: existing?.photoUrl,
      ...adminFields,
    };
    const saved = await upsertMember(admin);
    persistSessionUser(saved, true);
    return saved;
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

// ─── Realtime subscriptions ──────────────────────────────────────────────────

/**
 * Subscribe to a member document. Waits for a valid ID token before opening
 * the Firestore listener (avoids WebSocket auth with undefined token).
 * Falls back to local polling if token/Firestore is unavailable.
 */
export function subscribeToMember(
  id: string,
  callback: (member: Member | null) => void
): Unsubscribe {
  if (!id) {
    callback(null);
    return () => {};
  }

  let cancelled = false;
  let firestoreUnsub: Unsubscribe | null = null;
  let intervalId: number | null = null;

  const emitLocal = () => {
    const m = localGetAll().find((x) => x.id === id) ?? null;
    if (!cancelled) callback(m);
  };

  const startLocalPoll = () => {
    emitLocal();
    if (intervalId != null) return;
    intervalId = window.setInterval(emitLocal, 3000);
  };

  if (!isFirebaseConfigured()) {
    startLocalPoll();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.USERS || e.key === null) emitLocal();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
    };
  }

  // Bootstrap from local immediately so verification UI never blanks
  emitLocal();

  (async () => {
    // Wait briefly for auth token after login
    let token: string | null = null;
    for (let i = 0; i < 8 && !cancelled; i++) {
      token = await ensureAuthToken(i === 0);
      if (token) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (cancelled) return;

    if (!token) {
      console.warn('subscribeToMember: no auth token — using local poll only');
      startLocalPoll();
      return;
    }

    try {
      firestoreUnsub = onSnapshot(
        doc(getDb(), MEMBERS_COLLECTION, id),
        (snap) => {
          if (cancelled) return;
          if (!snap.exists()) {
            // Keep last known local user rather than blanking the page
            emitLocal();
            return;
          }
          const member = memberFromFirestore(
            snap.id,
            snap.data() as Record<string, unknown>
          );
          localUpsert(member);
          callback(member);
        },
        (err) => {
          console.error('subscribeToMember snapshot error', err);
          startLocalPoll();
        }
      );
    } catch (err) {
      console.error('subscribeToMember failed to attach', err);
      startLocalPoll();
    }
  })();

  return () => {
    cancelled = true;
    firestoreUnsub?.();
    if (intervalId != null) window.clearInterval(intervalId);
  };
}

/**
 * Auth session listener. Safe against null races and missing tokens.
 * Always invokes callback at least once so App can leave "Restoring session…".
 */
export function subscribeToAuthSession(
  callback: (member: Member | null) => void
): Unsubscribe {
  // Always deliver cache first for instant paint — never leave UI null-stuck
  const cached = getCachedSessionUser();
  try {
    callback(cached);
  } catch (err) {
    console.error('auth session initial callback failed', err);
  }

  if (!isFirebaseConfigured()) {
    return () => {};
  }

  let cancelled = false;
  let auth: ReturnType<typeof getFirebaseAuth>;
  let resolvedOnce = false;

  try {
    auth = getFirebaseAuth();
  } catch (err) {
    console.error('Firebase Auth unavailable — local session only', err);
    return () => {};
  }

  const unsub = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
    if (cancelled) return;

    if (!fbUser) {
      // Do not clear a fresh local-only session if Firebase briefly reports null
      // before credentials settle. Only clear after we've seen a real user once,
      // or when there is no local cache either.
      if (resolvedOnce || !getCachedSessionUser()) {
        clearSessionUser();
        callback(null);
      }
      return;
    }

    resolvedOnce = true;

    try {
      const token = await fbUser.getIdToken(false);
      if (!token || token === 'undefined' || cancelled) {
        if (!cancelled) callback(getCachedSessionUser() || cached);
        return;
      }

      let member = await getMemberById(fbUser.uid);
      if (!member) {
        member = defaultPendingMember({
          id: fbUser.uid,
          email: fbUser.email || '',
          name: fbUser.displayName || 'Member',
        });
        try {
          member = await upsertMember(member);
        } catch {
          /* keep shell */
        }
      }

      const safe = normalizeMember(member);
      if (!cancelled && safe) {
        persistSessionUser(safe, true);
        callback(safe);
      } else if (!cancelled) {
        callback(getCachedSessionUser() || cached);
      }
    } catch (err) {
      console.error('Auth session resolve failed', err);
      if (!cancelled) callback(getCachedSessionUser() || cached);
    }
  });

  return () => {
    cancelled = true;
    try {
      unsub();
    } catch {
      /* ignore */
    }
  };
}

export { isFirebaseConfigured };
