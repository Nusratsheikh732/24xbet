import { useState, useEffect, useRef } from 'react';
import { db, ref, get, onValue, push, set } from '@/lib/firebase';
import { footballMatches, cricketMatches } from '@/data/games';

export type SportCategory = 'football' | 'cricket';
export type MatchStatus = 'upcoming' | 'live' | 'finished';
export type MatchResult = 'pending' | 'home' | 'draw' | 'away';

export interface SportsMatch {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  category: SportCategory;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  matchDate: string;
  matchTime: string;
  status: MatchStatus;
  result: MatchResult;
  format?: string;
  venue?: string;
  createdAt: number;
}

let seedPromise: Promise<void> | null = null;

function getMatchStartTime(match: SportsMatch): number {
  const time = match.matchTime.trim() || '00:00';
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(match.matchDate.trim())
    ? match.matchDate.trim()
    : null;

  if (isoDate) {
    const timestamp = Date.parse(`${isoDate}T${time}:00`);
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  const now = new Date();
  const dayOffsets: Record<string, number> = {
    today: 0,
    tomorrow: 1,
    sun: (7 - now.getDay()) % 7 || 7,
    mon: (1 - now.getDay() + 7) % 7 || 7,
    tue: (2 - now.getDay() + 7) % 7 || 7,
    wed: (3 - now.getDay() + 7) % 7 || 7,
    thu: (4 - now.getDay() + 7) % 7 || 7,
    fri: (5 - now.getDay() + 7) % 7 || 7,
    sat: (6 - now.getDay() + 7) % 7 || 7,
  };
  const offset = dayOffsets[match.matchDate.trim().toLowerCase()];
  if (offset !== undefined) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date.getTime();
  }

  return match.createdAt;
}

async function seedDefaultsOnce() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const snap = await get(ref(db, 'sports_matches'));
    if (snap.exists()) return;

    const batch: Promise<unknown>[] = [];
    for (const m of footballMatches) {
      const mRef = push(ref(db, 'sports_matches'));
      batch.push(
        set(mRef, {
          league: m.league,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          category: 'football',
          homeOdds: m.homeOdds,
          drawOdds: m.drawOdds,
          awayOdds: m.awayOdds,
          matchDate: m.date,
          matchTime: m.time,
          status: 'upcoming',
          result: 'pending',
          format: '',
          venue: '',
          createdAt: Date.now() + Math.random() * 1000,
        }),
      );
    }
    for (const m of cricketMatches) {
      const mRef = push(ref(db, 'sports_matches'));
      batch.push(
        set(mRef, {
          league: m.league,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          category: 'cricket',
          homeOdds: m.homeOdds,
          drawOdds: m.drawOdds,
          awayOdds: m.awayOdds,
          matchDate: m.date,
          matchTime: m.time,
          status: m.status === 'live' ? 'live' : 'upcoming',
          result: 'pending',
          format: m.format,
          venue: m.venue,
          createdAt: Date.now() + Math.random() * 1000,
        }),
      );
    }
    await Promise.all(batch);
  })();
  return seedPromise;
}

export function useSportsMatches() {
  const [matches, setMatches] = useState<SportsMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      await seedDefaultsOnce();
      seededRef.current = true;

      unsub = onValue(ref(db, 'sports_matches'), (snap) => {
        const list: SportsMatch[] = [];
        if (snap.exists()) {
          const val = snap.val();
          Object.entries(val).forEach(([id, data]) => {
            const d = data as Record<string, unknown>;
            list.push({
              id,
              league: (d.league as string) || '',
              homeTeam: (d.homeTeam as string) || '',
              awayTeam: (d.awayTeam as string) || '',
              category: (d.category as SportCategory) || 'football',
              homeOdds: (d.homeOdds as number) ?? 2,
              drawOdds: (d.drawOdds as number) ?? 3,
              awayOdds: (d.awayOdds as number) ?? 2,
              matchDate: (d.matchDate as string) || '',
              matchTime: (d.matchTime as string) || '',
              status: (d.status as MatchStatus) || 'upcoming',
              result: (d.result as MatchResult) || 'pending',
              format: (d.format as string) || '',
              venue: (d.venue as string) || '',
              createdAt: (d.createdAt as number) || 0,
            });
          });
        }
        list.sort((a, b) => {
          const aFinished = a.status === 'finished';
          const bFinished = b.status === 'finished';
          if (aFinished !== bFinished) return aFinished ? 1 : -1;
          const timeDifference = getMatchStartTime(a) - getMatchStartTime(b);
          return aFinished ? -timeDifference : timeDifference;
        });
        setMatches(list);
        setLoading(false);
      }, () => setLoading(false));
    })();

    return () => { if (unsub) unsub(); };
  }, []);

  return { matches, loading };
}
