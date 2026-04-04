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

export type LobbyPlayer = {
  userId: string;
  firebaseUid: string;
  email: string | null;
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

export type Lobby = {
  id: string;
  inviteCode: string;
  hostUserId: string;
  state: "waiting" | "starting" | "in_game";
  settings: Record<string, unknown>;
  players: LobbyPlayer[];
  createdAt: string;
  updatedAt: string;
};
