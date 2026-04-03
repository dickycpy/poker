export interface Player {
  id: string;
  name: string;
  createdAt: number;
}

export interface GameRecord {
  id: string;
  playerId: string;
  date: string; // YYYY-MM-DD
  amount: number; // P&L
  createdAt: number;
}

export type NicknameType = 'KING' | 'WINNER' | 'NEUTRAL' | 'LOSER' | 'ATM';

export const NICKNAMES: Record<NicknameType, string[]> = {
  KING: ['賭神', '贏到開巷', '執到寶', '收割機'],
  WINNER: ['執雞', '執到錢', '小贏當大贏'],
  NEUTRAL: ['陪跑', '唔輸當贏', '路人甲'],
  LOSER: ['送財童子', '提款機', '慈善家'],
  ATM: ['慈善大王', '輸到仆街', '大慈善家', '輸到褲都甩'],
};

export function getNickname(rank: number, totalPlayers: number, amount: number, seed: string): string {
  const nicknames = amount > 0 
    ? (rank === 0 ? NICKNAMES.KING : NICKNAMES.WINNER)
    : amount < 0 
      ? (rank === totalPlayers - 1 ? NICKNAMES.ATM : NICKNAMES.LOSER)
      : NICKNAMES.NEUTRAL;
  
  // Simple deterministic hash from seed string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  
  return nicknames[Math.abs(hash) % nicknames.length];
}
