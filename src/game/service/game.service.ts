import {Injectable} from "@nestjs/common";
import FullCards from "../../script/cards";
import {Card} from "../../script/Card";
import {RoomModel, User} from "../../room/room.model";
import {RedisService} from "../../redis/service/redis.service";
import {RoomService} from "../../room/service/room.service";

@Injectable()
export class GameService {
  constructor(
    private redisService: RedisService,
    private roomService: RoomService,
  ) {
  }

  async getCards(): Promise<{}> {
    return FullCards;
  }

  async flushCards(): Promise<Card[]> {
    let fullCards: Card[] = FullCards;
    fullCards.sort(() => Math.random() - 0.5);
    return fullCards;
  }

  async startGame(slug: string, user: User): Promise<User[]> {
    const room = await this.roomService.getRoom(slug);
    if (room.host.username != user.username) throw new Error("Vous n'êtes pas le créateur de la room");
    if (room.currentPlayers < 3) throw new Error("Il n'y a pas assez de joueurs");
    if (room.started == true) throw new Error("La partie à déjà commencé");
    [room.users,] = await this.newRound(slug);
    await this.redisService.hset(`room:${slug}`, ['started', 'true']);
    return room.users;
  }

  async newRound(slug: string): Promise<[User[], number]> {
    const room = await this.roomService.getRoom(slug);
    const fullCards: Card[] = await this.flushCards();
    for (const [index, user] of room.users.entries()) {
      user.hasToPlay = index === 0;
      user.cards = fullCards.slice((room.currentRound + 1) * index, (room.currentRound + 1) * (index + 1));
    }
    await this.redisService.hset(`room:${slug}`, ['users', JSON.stringify(room.users), 'currentRound', (room.currentRound + 1).toString()]);
    await this.redisService.hset(`room:${slug}:${room.currentRound + 1}`, ['currentPli', '1']);
    return [room.users, room.currentRound +1];
  }

  cardInDeck(card: Card, deck: Card[]): boolean {
    return !!deck.find((elem: Card) => elem.id == card.id);
  }

  removeCardOnDeck(card: Card, deck: Card[]): Card[] {
    return deck.filter((elem: Card) => elem.id != card.id);
  }

  async getDeck(slug: string, user: User): Promise<Card[]> {
    const room: RoomModel = await this.roomService.getRoom(slug);
    return room.users.find((elem: User) => elem.username == user.username).cards;
  }
}

