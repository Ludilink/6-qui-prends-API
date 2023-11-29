import {
  ConnectedSocket, MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import {Socket} from 'socket.io';
import {RedisService} from "../redis/service/redis.service";
import {RoomService} from "./service/room.service";
import {Message} from "./dto/room.dto";
import {GameService} from "../game/service/game.service";
import {Play, User} from "./room.model";
import {Card} from "../script/Card";


@WebSocketGateway({cors: '*', namespace: 'room'})
export class RoomWebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {

  constructor(private readonly redisService: RedisService,
              private readonly roomService: RoomService,
              private readonly gameService: GameService) {
  }

  @WebSocketServer() server;

  handleConnection(socket: Socket): void {
    socket.data.user = {
      userId: socket.handshake.query.userId as string,
      socketId: socket.id,
      username: socket.handshake.query.username as string,
    };
    socket.data.slug = socket.handshake.query.slug as string
    console.log(`New connecting... socket id:`, socket.id);
  }

  handleDisconnect(socket: Socket): void {
    // gerer le cas si disconnect pendant une partie
    console.log(`Disconnecting... socket id:`, socket.id);
  }

  @SubscribeMessage('leaveRoom')
  async leaveRoom(@ConnectedSocket() client: Socket) {
    this.server.to(client.data.slug).emit('members', await this.roomService.usersWithoutCardsInRoom(client.data.slug));
  }

  @SubscribeMessage('joinRoom')
  async joinRoom(@ConnectedSocket() client: Socket): Promise<{}> {
    return this.handleAction(client.data.slug, async () => {
      await this.roomService.addUserToRoom(client.data.slug, client.data.user)
      client.join(client.data.slug);
      await this.emitUpdate(client.data.slug, client);
      return {gameIsStarted: await this.roomService.gameIsStarted(client.data.slug)};
    });
  }

  @SubscribeMessage('chat')
  chat(@ConnectedSocket() client: Socket, @MessageBody() message: Message): { message: string } {
    // console.log("API chat message -> ", message);
    this.server.to(client.data.slug).emit('chat', message, client.data.user); // broadcast messages
    return {message: "Message bien envoyé"};
  }

  @SubscribeMessage('startGame')
  async startGame(@ConnectedSocket() client: Socket): Promise<{}> {
    return this.handleAction(client.data.slug, async () => {
      const users: User[] = await this.gameService.startGame(client.data.slug, client.data.user);
      for (const user of users) {
        this.server.to(user.socketId).emit('cards', user.cards);
      }
      this.server.to(client.data.slug).emit('gameStarted', true); // broadcast messages gameStarted
      await this.emitUpdate(client.data.slug, client);
      return {gameIsStarted: await this.roomService.gameIsStarted(client.data.slug)};
    });
  }

  @SubscribeMessage('play')
  async play(@ConnectedSocket() client: Socket, @MessageBody() card: Card): Promise<{}> {
    return this.handleAction(client.data.slug, async () => {
      await this.gameService.play(card, client.data.user, client.data.slug);
      await this.emitUpdate(client.data.slug, client);
      if (await this.gameService.checkEveryonePlayed(client.data.slug)) {
        await this.roundTurn(client);
      }
    });
  }

  @SubscribeMessage('chooseSlot')
  async chooseSlot(@ConnectedSocket() client: Socket, @MessageBody() slotIndex: number): Promise<{}> {
    return this.handleAction(client.data.slug, async () => {
      await this.gameService.chooseSlot(slotIndex, client.data.slug, client.data.user);
      await this.emitUpdate(client.data.slug, client);
      await this.roundTurn(client);
    });
  }

  async handleAction(slug: string, callback: Function): Promise<{}> {
    try {
      if (await this.redisService.exists(`room:${slug}`)) {
        return await callback();
      } else {
        throw new Error("La room n'existe pas");
      }
    } catch (e) {
      return {
        error: e.message,
      }
    }
  }

  async emitUpdate(slug: string, client: Socket) {
    this.server.to(slug).emit('members', await this.roomService.usersWithoutCardsInRoom(slug));
    this.server.to(slug).emit('board', await this.gameService.getBoard(slug));
    this.server.to(client.data.user.socketId).emit('cards', await this.gameService.getDeck(client.data.slug, client.data.user));
    this.server.to(slug).emit('playerHasToPlay', await this.gameService.getPlayerHasToPlay(slug));
  }

  async roundTurn(client: Socket): Promise<void> {
    let cards: Play[] = await this.gameService.sortCardsPlayed(client.data.slug);
    for (const play of cards) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      let gamePaused: boolean = await this.gameService.playCard(play, client.data.slug);
      await this.emitUpdate(client.data.slug, client);
      if (gamePaused) {
        return;
      }
    }
    if (await this.gameService.checkEnd(client.data.slug)) {

    }
    await this.gameService.startRound(client.data.slug);
    await this.emitUpdate(client.data.slug, client);
  }
}
