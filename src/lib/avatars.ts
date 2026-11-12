import { db, ref, get } from '@/lib/firebase';
import { PROFILE_AVATARS } from '@/data/profileAvatars';

export async function getTakenAvatars(excludeUid?: string): Promise<Set<string>> {
  const snap = await get(ref(db, 'users'));
  const taken = new Set<string>();
  if (snap.exists()) {
    const val = snap.val();
    Object.entries(val).forEach(([id, data]) => {
      if (id === excludeUid) return;
      const a = (data as Record<string, unknown>).avatar;
      if (typeof a === 'string' && a) taken.add(a);
    });
  }
  return taken;
}

export async function pickRandomAvatar(excludeUid?: string): Promise<string> {
  let pool = PROFILE_AVATARS;
  try {
    const taken = await getTakenAvatars(excludeUid);
    const available = PROFILE_AVATARS.filter((a) => !taken.has(a));
    if (available.length > 0) pool = available;
  } catch {
    // fall back to the full list
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
