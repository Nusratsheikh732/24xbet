export interface SimBet {
  id: string;
  user: string;
  amount: number;
  multiplier: number | null;
  cashedOut: boolean;
  win: number | null;
}

const BOT_NAMES = [
  'Rahim', 'Karim', 'Tanvir', 'Sabbir', 'Nayem', 'Ripon', 'Shakil', 'Mizan',
  'Rakib', 'Farhan', 'Imran', 'Nayeem', 'Sajid', 'Tareq', 'Mehedi', 'Shorif',
  'Junaid', 'Nabil', 'Hasan', 'Rashed', 'Arafat', 'Suman', 'Jewel', 'Rony',
  'Polash', 'Mintu', 'Kawsar', 'Shuvo', 'Rasel', 'Niloy', 'Shakil', 'Bappy',
  'Mamun', 'Rumman', 'Sabbir', 'Shanto', 'Touhid', 'Wahid', 'Yasin', 'Zihan',
  'Arif', 'Babu', 'Chowdhury', 'Dipu', 'Emon', 'Faisal', 'Galib', 'Habib',
  'Sadia', 'Tania', 'Nusrat', 'Jannat', 'Riya', 'Mitu', 'Kabita', 'Liza',
  'Mim', 'Nila', 'Opala', 'Priya', 'Rima', 'Sonia', 'Tisha', 'Uma',
  'pro_gamer', 'skyDiver', 'crashKing', 'lucky77', 'bigShot', 'falconX',
  'nightRider', 'acePilot', 'goldRush', 'blazeUp', 'turboX', 'phantomZ',
  'CryptoBro', 'HighRoller', 'RiskTaker', 'CasinoQ', 'BetMaster', 'ZeroFear',
  'Ashik', 'Delwar', 'Gias', 'Helal', 'Jibon', 'Kamrul', 'Liton', 'Mursalin',
  'Nizam', 'Omar', 'Parvez', 'Quazi', 'Rabbani', 'Saiful', 'Titu', 'Ujjal',
  'player_1', 'player_42', 'player_99', 'user_2024', 'user_365', 'user_789',
];

const BET_AMOUNTS = [10, 20, 25, 50, 50, 100, 100, 150, 200, 200, 300, 500, 500, 750, 1000, 1000, 2000, 5000];

function randomName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + (Math.random() < 0.3 ? Math.floor(Math.random() * 99) : '');
}

function randomAmount(): number {
  return BET_AMOUNTS[Math.floor(Math.random() * BET_AMOUNTS.length)];
}

function generateCashOutMultiplier(): number {
  const r = Math.random();
  if (r < 0.30) return parseFloat((1.05 + Math.random() * 0.45).toFixed(2));
  if (r < 0.55) return parseFloat((1.5 + Math.random() * 0.99).toFixed(2));
  if (r < 0.75) return parseFloat((2.5 + Math.random() * 1.5).toFixed(2));
  if (r < 0.90) return parseFloat((4 + Math.random() * 3).toFixed(2));
  return parseFloat((7 + Math.random() * 5).toFixed(2));
}

export function generateSimBets(crashPoint: number): SimBet[] {
  const count = Math.floor(Math.random() * 401) + 100;
  const bets: SimBet[] = [];

  for (let i = 0; i < count; i++) {
    const cashOutTarget = generateCashOutMultiplier();
    const willCashOut = cashOutTarget < crashPoint;
    const amount = randomAmount();

    if (willCashOut) {
      const mult = parseFloat(cashOutTarget.toFixed(2));
      bets.push({
        id: `bot-${i}`,
        user: randomName(),
        amount,
        multiplier: mult,
        cashedOut: true,
        win: parseFloat((amount * mult).toFixed(2)),
      });
    } else {
      bets.push({
        id: `bot-${i}`,
        user: randomName(),
        amount,
        multiplier: null,
        cashedOut: false,
        win: null,
      });
    }
  }

  return bets;
}

export interface SimBetWithTiming extends SimBet {
  cashOutDelay: number;
}

export function generateSimBetsWithTiming(crashPoint: number): SimBetWithTiming[] {
  const count = Math.floor(Math.random() * 401) + 100;
  const bets: SimBetWithTiming[] = [];

  for (let i = 0; i < count; i++) {
    const cashOutTarget = generateCashOutMultiplier();
    const willCashOut = cashOutTarget < crashPoint;
    const amount = randomAmount();

    if (willCashOut) {
      const mult = parseFloat(cashOutTarget.toFixed(2));
      // Convert multiplier to time-based delay: t = ln(mult) / k where k=0.35
      const cashOutDelay = Math.log(cashOutTarget) / 0.35;
      bets.push({
        id: `bot-${i}`,
        user: randomName(),
        amount,
        multiplier: mult,
        cashedOut: true,
        win: parseFloat((amount * mult).toFixed(2)),
        cashOutDelay,
      });
    } else {
      bets.push({
        id: `bot-${i}`,
        user: randomName(),
        amount,
        multiplier: null,
        cashedOut: false,
        win: null,
        cashOutDelay: -1,
      });
    }
  }

  return bets;
}
