/**
 * Push notifications — never subscribe with an empty/undefined VAPID key.
 */

import type { Notification as AppNotification } from '../types';

function getVapidKey(): string | null {
  const key =
    (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
    (typeof process !== 'undefined'
      ? process.env?.REACT_APP_VAPID_PUBLIC_KEY
      : undefined) ||
    '';
  const trimmed = String(key || '').trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed.startsWith('@')) {
    return null;
  }
  return trimmed;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const notificationService = {
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') return true;

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    }

    return false;
  },

  async sendNotification(title: string, options?: NotificationOptions): Promise<void> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) return;
      new Notification(title, options || {});
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  },

  async sendNotifications(notifications: AppNotification[]): Promise<void> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) return;

      (notifications || []).forEach((notification) => {
        if (!notification) return;
        new Notification(notification.title || 'YSI', {
          body: notification.message || '',
          tag: notification.id,
        });
      });
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  },

  async subscribeToNotifications(): Promise<PushSubscription | null> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return null;
      }

      const vapid = getVapidKey();
      if (!vapid) {
        // Avoid Web Push subscribe with undefined/empty applicationServerKey
        console.log('VAPID public key not configured — skip push subscribe');
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  },
};
