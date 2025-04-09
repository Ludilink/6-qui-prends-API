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
import * as schedule from 'node-schedule';


@WebSocketGateway({cors: '*', namespace: 'room'})
export class RoomWebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {

  constructor(private readonly redisService: RedisService,
              private readonly roomService: RoomService,
              private readonly gameService: GameService) {
  }

  @WebSocketServer() server;

  private timer: schedule.Job;

  handleConnection(socket: Socket): void {
    socket.data.user = {
      userId: socket.handshake.query?.userId as string,
      socketId: socket.id,
      username: socket.handshake.query?.username as string,
    };
    socket.data.slug = socket.handshake.query.slug as string;
    console.log(`New connecting... socket id:`, socket.id);
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    await this.roomService.setOffline(socket.data.slug, socket.data.user);
    this.server.to(socket.data.slug).emit('members', await this.roomService.usersWithoutCardsInRoom(socket.data.slug));
    if (!this.server.adapter.rooms.get(socket.data.slug)) {
      schedule.scheduleJob(new Date(Date.now() + 10 * 60 * 1000), async () => {
        await this.deleteRoom(socket);
      });
    }
    console.log(`Disconnecting... socket id:`, socket.id);
  }

  async deleteRoom(socket: Socket) {
    if (!this.server.adapter.rooms.get(socket.data.slug)) {
      await this.roomService.closeRoom(socket.data.slug);
    }
  }

  @SubscribeMessage('leaveRoom')
  async leaveRoom(@ConnectedSocket() client: Socket) {
    return this.handleAction(client.data.slug, async () => {
      await this.roomService.setOffline(client.data.slug, client.data.user);
      this.server.to(client.data.slug).emit('members', await this.roomService.usersWithoutCardsInRoom(client.data.slug));
      return {
        message: 'Vous avez quitté la room',
      };
    });
  }

  @SubscribeMessage('quitRoom')
  async quitRoom(@ConnectedSocket() client: Socket): Promise<unknown> {
    return this.handleAction(client.data.slug, async () => {
      await this.roomService.removeUserFromRoom(client.data.slug, client.data.user);
      this.server.to(client.data.slug).emit('members', await this.roomService.usersWithoutCardsInRoom(client.data.slug));
      return {
        message: "Vous avez quitté la room",
      };
    });
  }


  @SubscribeMessage('joinRoom')
  async joinRoom(@ConnectedSocket() client: Socket): Promise<unknown> {
    return this.handleAction(client.data.slug, async () => {
      await this.roomService.addUserToRoom(client.data.slug, client.data.user)
      client.join(client.data.slug);
      await this.emitUpdate(client.data.slug, client);
      return {gameStatus: await this.roomService.gameStatus(client.data.slug)};
    });
  }

  @SubscribeMessage('chat')
  chat(@ConnectedSocket() client: Socket, @MessageBody() message: Message): { message: string } {
    this.server.to(client.data.slug).emit('chat', message, client.data.user); // broadcast messages
    return {message: "Message bien envoyé"};
  }

  @SubscribeMessage('startGame')
  async startGame(@ConnectedSocket() client: Socket): Promise<unknown> {
    return this.handleAction(client.data.slug, async () => {
      const users: User[] = await this.gameService.startGame(client.data.slug, client.data.user);
      for (const user of users) {
        this.server.to(user.socketId).emit('cards', user.cards);
      }
      this.server.to(client.data.slug).emit('gameStarted', true); // broadcast messages gameStarted
      await this.emitUpdate(client.data.slug, client);
      return {gameStatus: await this.roomService.gameStatus(client.data.slug)};
    });
  }

  @SubscribeMessage('play')
  async play(@ConnectedSocket() client: Socket, @MessageBody() card: Card): Promise<unknown> {
    return this.handleAction(client.data.slug, async () => {
      await this.gameService.play(card, client.data.user, client.data.slug);
      await this.server.to(client.data.user.socketId).emit('setCard', card);
      await this.emitUpdate(client.data.slug, client);
      this.stopTimer();
      if (await this.gameService.checkEveryonePlayed(client.data.slug)) {
        await this.roundTurn(client);
      }
    });
  }

  @SubscribeMessage('chooseSlot')
  async chooseSlot(@ConnectedSocket() client: Socket, @MessageBody() slotIndex: number): Promise<unknown> {
    return this.handleAction(client.data.slug, async () => {
      await this.gameService.chooseSlot(slotIndex, client.data.slug, client.data.user);
      await this.emitUpdate(client.data.slug, client);
      await this.roundTurn(client);
    });
  }

  async handleAction(slug: string, callback: () => unknown): Promise<unknown> {
    try {
      if (await this.redisService.exists(`room:${slug}`)) {
        return await callback();
      } else {
        console.log("ROOM NOT FOUND");
        throw new Error("La room n'existe pas");
      }
    } catch (e) {
      return {
        error: e.message,
      };
    }
  }

  async emitUpdate(slug: string, client: Socket) {
    this.server.to(slug).emit('members', await this.roomService.usersWithoutCardsInRoom(slug));
    this.server.to(slug).emit('board', await this.gameService.getBoard(slug));
    this.server.to(client.data.user.socketId).emit('cards', await this.gameService.getDeck(client.data.slug, client.data.user));
    this.server.to(slug).emit('playerHasToPlay', await this.gameService.getPlayerHasToPlay(slug));
  }

  async roundTurn(client: Socket): Promise<void> {
    const cards: Play[] = await this.gameService.sortCardsPlayed(client.data.slug);
    for (const play of cards) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const gamePaused: boolean = await this.gameService.playCard(play, client.data.slug);
      this.server.to(play.user.socketId).emit('flushCard');
      await this.emitUpdate(client.data.slug, client);
      if (gamePaused) {
        return;
      }
    }
    if (await this.gameService.checkEnd(client.data.slug)) {
      await this.gameService.endGame(client.data.slug);
      await this.server.to(client.data.slug).emit('winners', await this.gameService.getClassement(client.data.slug));
    } else {
      await this.gameService.startRound(client.data.slug);
      this.startTimer(client);
      await this.emitUpdate(client.data.slug, client);
    }
  }

  startTimer(socket: Socket) {
    let timeRemaining: number = 30;
    const timerInterval = setInterval(async () => {
      timeRemaining--;
      if (timeRemaining >= 0) {
        // this.server.to(socket.data.slug).emit('timer', timeRemaining);
        await this.gameService.timeleftToUsers(socket.data.slug, this.server, timeRemaining)
      } else {
        this.server.to(socket.data.slug).emit('timer', null);
      }
    }, 1000);

    this.timer = schedule.scheduleJob(new Date(Date.now() + 30 * 1000), () => {
      this.server.to(socket.data.slug).emit('timer', null);
      clearInterval(timerInterval);
    });
  }

  stopTimer() {
    if (this.timer) {
      this.timer.cancel();
      this.timer = null;
    }
  }
}
