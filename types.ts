/**
 * All data type definitions for the YSI application
 */

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}
