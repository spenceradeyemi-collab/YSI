
export enum AppView {
  AUTH = 'AUTH',
  HOME = 'HOME',
  HERITAGE = 'HERITAGE',
  LANGUAGE = 'LANGUAGE',
  PROFILE = 'PROFILE',
  ADMIN = 'ADMIN',
  CREATE_POST = 'CREATE_POST',
  CALENDAR = 'CALENDAR',
  DIRECTORY = 'DIRECTORY',
  MESSAGING = 'MESSAGING',
  STUDIO = 'STUDIO',
  HELP = 'HELP',
  LEDGER = 'LEDGER'
}

export type MemberStatus = 'pending' | 'intending' | 'active' | 'rejected';
export type AdminRole = 'SUPER' | 'SECRETARY' | 'TREASURER' | 'PRO' | 'ADMIN' | 'MEMBER' | null;

export type Permission = 
  | 'CREATE_POST' 
  | 'EDIT_POST' 
  | 'DELETE_POST' 
  | 'LIKE_POST'
  | 'COMMENT_POST'
  | 'APPROVE_MEMBER' 
  | 'MANAGE_FINANCES' 
  | 'VIEW_LOGS' 
  | 'ASSIGN_ROLES'
  | 'registry_access'
  | 'moderation_access'
  | 'treasury_access'
  | 'attendance_access'
  | 'directory_access'
  | 'system_access'
  | 'logs_access'
  | 'master_access';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  description?: string;
}

export interface AttendanceData {
  [meetingId: string]: string[];
}

export interface Notification {
  id: string;
  type: 'MEMBER_JOIN' | 'EVENT_CREATED' | 'SYSTEM' | 'POST_CREATED' | 'MESSAGE_RECEIVED';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  metadata?: any;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  date: number;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  authorTribe?: string;
  imageUrl?: string;
  date: number;
  likes: string[]; // Array of user IDs
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  expiryDate?: number;
  comments: Comment[];
}

export interface DuesRecord {
  [yearMonth: string]: {
    paid: boolean;
    amount: number;
    transactionId?: string;
    updatedAt: number;
  };
}

export interface PhotoSettings {
  scale: number;
  x: number;
  y: number;
}

export interface Member {
  id: string; 
  memberId: string;
  name: string;
  email: string;
  password?: string;
  status: MemberStatus;
  isAdmin?: boolean;
  adminRole: AdminRole;
  permissions: Permission[];
  tribe?: string;
  profession?: string;
  role: string;
  bio?: string;
  photoUrl?: string;
  photoSettings?: PhotoSettings;
  isPaidMember: boolean;
  paymentHistory: { id: string; date: number; amount: number; description: string }[];
  dues: DuesRecord;
  onboardingComplete?: boolean;
  lastPasswordReset?: number;
  birthday: string; // Mandatory Date of Birth
  joinDate: number;
  lastActive: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'EVENT' | 'BIRTHDAY' | 'HOLIDAY';
  description?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface CommunityMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  photoUrl?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: number;
  read: boolean;
}

export enum ImageSize { SIZE_1K = '1K', SIZE_2K = '2K', SIZE_4K = '4K' }
export enum AspectRatio { SQUARE = '1:1', LANDSCAPE = '16:9', PORTRAIT = '9:16' }
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Experts';

export interface QuizData { sentence: string; options: string[]; answer: string; english: string; explanation: string; }
export interface MatchingPair { id: string; yoruba: string; english: string; }
export interface MasoyinboQuestion { type: 'PROVERB' | 'SPELLING' | 'CULTURE'; question: string; options: string[]; answer: string; explanation: string; }
