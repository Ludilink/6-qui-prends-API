import {Injectable} from "@nestjs/common";
import {Card} from "../../script/Card";
import {Board, RoomModel, User} from "../../room/room.model";
import {RedisService} from "../../redis/service/redis.service";
import {RoomService} from "../../room/service/room.service";
import cards from "../../script/cards";

@Injectable()
export class GameService {
  constructor(
    private redisService: RedisService,
    private roomService: RoomService,
  ) {
  }

  async getCards(nb: number): Promise<Card[]> {
    return cards(nb);
  }

  async flushCards(nb: number): Promise<Card[]> {
    let fullCards: Card[] = cards(nb);
    fullCards.sort(() => Math.random() - 0.5);
    return fullCards;
  }

  async startGame(slug: string, user: User): Promise<User[]> {
    const room = await this.roomService.getRoom(slug);
    if (room.host.userId != user.userId) throw new Error("Vous n'êtes pas le créateur de la room");
    if (room.currentPlayers < 2) throw new Error("Il n'y a pas assez de joueurs");
    if (room.started == true) throw new Error("La partie à déjà commencé");
    const fullCards: Card[] = await this.flushCards(room.currentPlayers);
    for (const [index, user] of room.users.entries()) {
      user.cards = fullCards.slice(index * 10, (index + 1) * 10);
      user.hasToPlay = true;
      user.cardsLost = [];
    }
    room.board = {
      slot1: {
        cards: [fullCards[fullCards.length - 1]],
      },
      slot2: {
        cards: [fullCards[fullCards.length - 2]]
      },
      slot3: {
        cards: [fullCards[fullCards.length - 3]]
      },
      slot4: {
        cards: [fullCards[fullCards.length - 4]]
      },
    }
    await this.redisService.hset(`room:${slug}`, ['started', 'true', 'users', JSON.stringify(room.users), 'board', JSON.stringify(room.board)]);
    console.log("API startGame -> ", room)
    return room.users;
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

  async getBoard(slug: string): Promise<Board> {
    const room: RoomModel = await this.roomService.getRoom(slug);
    return room.board;
  }
}

