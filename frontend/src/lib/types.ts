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
};

export type Lobby = {
  id: string;
  inviteCode: string;
  hostUserId: string;
  state: LobbyState;
  settings: Record<string, unknown>;
  players: LobbyPlayer[];
  createdAt: string;
  updatedAt: string;
};
