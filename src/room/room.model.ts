import {Card} from "../script/Card";

export interface RoomModel {
  slug: string;
  password?: string;
  users: User[];
  maxPlayers: number;
  currentPlayers: number;
  host: UserInRoom;
  status: GameStatus;
  playerHasToPlay: User | null;
  currentRound: number;
  board: Board;
}

export interface RoundModel {
  cards: Play[]
}

export interface SimpleUser {
  userId: string
  username: string
}

export interface UserInRoom {
  userId: string
  username: string
  socketId: string
  hasToPlay: boolean
  bullsLost?: number
}

export interface User extends UserInRoom {
  cards: Card[]
}

export interface UserWithHost extends UserInRoom {
  isHost: boolean
}

export interface Slot {
  cards: Card[]
}

export interface Board {
  slot1: Slot
  slot2: Slot
  slot3: Slot
  slot4: Slot
}

export interface Play {
  card: Card
  user: User
}

export enum GameStatus {
  UNSTARTED = 'UNSTARTED',
  CHOOSE_CARD = 'CHOOSE_CARD',
  CHOOSE_SLOT = 'CHOOSE_SLOT',
  END_GAME = 'END_GAME'
}

