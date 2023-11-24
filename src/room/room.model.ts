import {Card} from "../script/Card";

export interface RoomModel {
  slug: string;
  password?: string;
  users: User[];
  maxPlayers: number;
  currentPlayers: number;
  host: UserInRoom;
  started: boolean;
  currentRound: number;
  board: Board;
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
}

export interface User extends UserInRoom {
  cards: Card[]
  cardsLost?: Card[]
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

