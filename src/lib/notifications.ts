import { db, ref, get, update, push, set } from '@/lib/firebase';

export type NotificationPermissionState = 'granted' | 'denied' | 'default';

export function getBrowserPermission(): NotificationPermissionState {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result as NotificationPermissionState;
}

export function showNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: `notif-${Date.now()}`,
    });
  } catch {
    // Some browsers require a service worker for notifications
  }
}

export async function hasAskedPermission(uid: string): Promise<boolean> {
  try {
    const snap = await get(ref(db, 'users/' + uid));
    if (snap.exists()) {
      return snap.val().notifPermissionAsked === true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function markPermissionAsked(uid: string): Promise<void> {
  try {
    await update(ref(db, 'users/' + uid), { notifPermissionAsked: true });
  } catch {
    // ignore
  }
}

export async function sendCustomNotification(
  targetUid: string,
  title: string,
  body: string
): Promise<void> {
  const notifRef = push(ref(db, 'notifications'));
  await set(notifRef, {
    targetUid,
    title,
    body,
    read: false,
    createdAt: Date.now(),
  });
}
