import {IsInt, IsNotEmpty, IsOptional, Max, Min} from "class-validator";
import {UserInRoom} from "../room.model";

export class CreatedRoomDto {
  @IsNotEmpty({message: "Le nombre maximum de joueurs ne peut pas être vide"})
  @IsInt({message: "Le nombre maximum de joueurs doit être un nombre entier"})
  @Min(2, {message: "Le nombre de joueurs doit être supérieur ou égal à 2"})
  @Max(8, {message: "Le nombre de joueurs doit être inférieur ou égal à 8"})
  maxPlayers: number;

  @IsOptional()
  password?: string;

  @IsNotEmpty({message: "L'hôte ne peut pas être vide"})
  host: UserInRoom;
}

export class RoomDto {
  slug: string;
}

export class Message {
  timeSent: string;
  text: string;
}