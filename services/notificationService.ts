/**
 * Service for handling push notifications
 */

import type { Notification } from '../types';

export const notificationService = {
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

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
      
      if (!hasPermission) {
        console.log('Notification permission not granted');
        return;
      }

      new Notification(title, options || {});
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  },

  async sendNotifications(notifications: Notification[]): Promise<void> {
    try {
      const hasPermission = await this.requestPermission();
      
      if (!hasPermission) {
        console.log('Notification permission not granted');
        return;
      }

      notifications.forEach(notification => {
        new Notification(notification.title, {
          body: notification.message,
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

      const registration = await navigator.serviceWorker.ready;
      
      return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY || '',
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  },
};
