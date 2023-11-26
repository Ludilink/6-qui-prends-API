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
import {Play, SimpleUser, User} from "./room.model";
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
      this.server.to(client.data.user.socketId).emit('cards', await this.gameService.getDeck(client.data.slug, client.data.user));
      this.server.to(client.data.slug).emit('members', await this.roomService.usersWithoutCardsInRoom(client.data.slug));
      this.server.to(client.data.slug).emit('board', await this.gameService.getBoard(client.data.slug));
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
      this.server.to(client.data.slug).emit('members', await this.roomService.usersWithoutCardsInRoom(client.data.slug));
      this.server.to(client.data.slug).emit('board', await this.gameService.getBoard(client.data.slug));
      return {gameIsStarted: await this.roomService.gameIsStarted(client.data.slug)};
    });
  }

  @SubscribeMessage('play')
  async play(@ConnectedSocket() client: Socket, @MessageBody() card: Card): Promise<{}> {
    return this.handleAction(client.data.slug, async () => {
      await this.gameService.play(card, client.data.user, client.data.slug)
      this.server.to(client.data.socketId).emit('cards', await this.gameService.getDeck(client.data.slug, client.data.user));
      this.server.to(client.data.slug).emit('members', await this.roomService.usersWithoutCardsInRoom(client.data.slug));
      if (this.gameService.checkEveryonePlayed(client.data.slug)) {
        let cards: Play[] = await this.gameService.sortCardsPlayed(client.data.slug);
        for (const play of cards) {
          setTimeout(async () => {
            await this.gameService.playCard(play, client.data.slug);
          });
        }
      }
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
}
