export type Page = 'home' | 'profile' | 'refer' | 'admin' | 'aviator' | 'superace' | 'roulette' | 'slots' | 'wildfrontier' | 'superelements' | 'flyx' | 'promotion' | 'reward' | 'mission' | 'signin' | 'bonus' | 'rescue' | 'airdrop' | 'ludo' | 'trading' | 'spinwheel' | 'predictionmarket' | 'wildbounty' | 'sevenup' | 'crazytime';

export type GameCategory = 'jili' | 'casino';

export type GameType = 'slots' | 'dice' | 'coinflip' | 'wheel' | 'cards' | 'roulette' | 'board';

export interface Game {
  id: string;
  name: string;
  category: GameCategory;
  image: string;
  tag?: string;
  hot?: boolean;
  gameType: GameType;
}

export interface FootballMatch {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  time: string;
  date: string;
  status: 'upcoming' | 'live' | 'finished';
  result: 'pending' | 'home' | 'draw' | 'away';
}

export interface DepositMethod {
  id: string;
  name: string;
  logo: string;
  color: string;
}

export interface CrashHistory {
  multiplier: number;
  color: string;
}

export interface Prediction {
  id: string;
  matchId: string;
  selection: 'home' | 'draw' | 'away';
  amount: number;
  odds: number;
  team: string;
  status: 'pending' | 'won' | 'lost';
  payout: number;
}

export interface CricketMatch {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  time: string;
  date: string;
  format: string;
  venue: string;
  status: 'upcoming' | 'live' | 'finished';
  result: 'pending' | 'home' | 'draw' | 'away';
}
