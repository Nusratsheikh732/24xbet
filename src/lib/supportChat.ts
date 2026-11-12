import { db, ref, push, set } from '@/lib/firebase';

export interface SupportIdentity {
  uid: string;
  name: string;
  phone: string;
}

export interface SupportMessageRecord {
  sender: 'user' | 'admin';
  text: string;
  createdAt: number;
  status?: 'open' | 'resolved';
}

export async function sendSupportMessage(identity: SupportIdentity, text: string) {
  if (!identity.uid) throw new Error('Not signed in');
  const now = Date.now();
  await set(push(ref(db, `support/messages/${identity.uid}`)), {
    sender: 'user',
    text,
    status: 'open',
    createdAt: now,
    userName: identity.name || 'Unknown',
    userPhone: identity.phone || '',
  });
  await set(ref(db, `support/conversations/${identity.uid}`), {
    userName: identity.name || 'Unknown',
    userPhone: identity.phone || '',
    lastMessage: text,
    lastAt: now,
    status: 'open',
    updatedAt: now,
  });
}
