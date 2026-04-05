export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  xp: number;
  level: number;
  className: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
};

export type LobbyState = "waiting" | "starting" | "in_game";
export type MatchStatus = "active" | "finished";

export type LobbyPlayer = {
  userId: string;
  displayName: string | null;
  xp: number;
  level: number;
  className: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  ready: boolean;
  isHost: boolean;
  joinedAt: string;
};

export type MatchPlayer = {
  userId: string;
  health: number;
};

export type MatchAction = {
  attackerUserId: string;
  targetUserId: string;
  damage: number;
  score: number | null;
  targetDefeated: boolean;
  occurredAt: string;
};

export type LobbyMatch = {
  maxHealth: number;
  damagePerAttack: number;
  status: MatchStatus;
  winnerUserId: string | null;
  players: MatchPlayer[];
  startedAt: string;
  endedAt: string | null;
  lastAction: MatchAction | null;
};

export type Lobby = {
  id: string;
  inviteCode: string;
  hostUserId: string;
  state: LobbyState;
  settings: Record<string, unknown>;
  match: LobbyMatch | null;
  players: LobbyPlayer[];
  createdAt: string;
  updatedAt: string;
};
