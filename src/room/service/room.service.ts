import {Injectable} from '@nestjs/common';
import {RedisService} from "../../redis/service/redis.service";
import {GameStatus, RoomModel, RoundModel, User, UserInRoom, UserWithHost} from "../room.model";
import {HttpException} from "@nestjs/common/exceptions";
import {WordsGlossaryService} from "../../words-glossary/service/words-glossary.service";

@Injectable()
export class RoomService {

  constructor(
    private redisService: RedisService,
    private wordGlossaryService: WordsGlossaryService
  ) {
  }

  async createRoom(maxPlayers: number, host: UserInRoom, password?: string): Promise<RoomModel> {
    let user: User =  {
      ...host,
      cards: [],
      hasToPlay: true,
      bullsLost: 0,
    }
    const room: RoomModel = {
      slug: await this.wordGlossaryService.GetThreeWord(),
      maxPlayers: maxPlayers,
      currentPlayers: 1,
      password: password,
      users: [user],
      host: host,
      status: GameStatus.UNSTARTED,
      playerHasToPlay: null,
      currentRound: 0,
      board: {
        slot1: {
          cards: []
        },
        slot2: {
          cards: []
        },
        slot3: {
          cards: []
        },
        slot4: {
          cards: []
        },
      }
    }
    let roomKey = `room:${room.slug}`;
    // check if key exists in redis to not overwrite
    while (await this.redisService.exists(roomKey) == 1) {
      room.slug = await this.wordGlossaryService.GetThreeWord();
      roomKey = `room:${room.slug}`;
    }
    await this.redisService.hset(roomKey, [
      'maxPlayers', room.maxPlayers.toString(),
      'currentPlayers', room.currentPlayers.toString(),
      'password', room.password ?? '',
      'users', JSON.stringify(room.users),
      'host', JSON.stringify(room.host),
      'slug', room.slug,
      'status', room.status.toString(),
      'currentRound', '0',
      'board', JSON.stringify(room.board),
      'playerHasToPlay', JSON.stringify(room.playerHasToPlay),
    ]);
    return room;
  }

  async closeRoom(slug: string): Promise<{}> {
    const roomKeys: string[] = await this.redisService.keys(`room:${slug}*`);
    for (const roomKey of roomKeys) {
      if (await this.redisService.exists(roomKey) == 0) {
        continue;
      }
      await this.redisService.del(roomKey);
    }
    return {
      message: `La room ${slug} a bien été supprimée`
    };
  }

  async addUserToRoom(slug: string, user: User): Promise<void> {
    const room: RoomModel = await this.getRoom(slug);
    if (room) {
      if (room.status != GameStatus.UNSTARTED && !room.users.find((element: User) => user.userId == element.userId)) throw new Error("La partie à déjà commencé");
      if (room.currentPlayers >= room.maxPlayers && !room.users.find((element: User) => user.userId === element.userId)) throw new Error("La room est pleine");
      if (room.host.userId == user.userId) {
        let host = room.users.find((element: User) => element.userId == user.userId)
        if (!host) room.users.push(user)
        else host.socketId = user.socketId
        await this.redisService.hset(`room:${slug}`, ['host', JSON.stringify(user), 'users', JSON.stringify(room.users)]);
      } else if (room.users.find((element: User) => element.userId == user.userId)) {
        room.users.find((element: User) => element.userId == user.userId).socketId = user.socketId;
        await this.redisService.hset(`room:${slug}`, ['users', JSON.stringify(room.users)]);
      } else {
        await this.redisService.hset(`room:${slug}`, ['users', JSON.stringify([...room.users, user]), 'currentPlayers', (room.currentPlayers + 1).toString()]);
      }
    } else {
      throw new Error(`La room ${slug} n'existe pas`);
    }
  }

  async removeUserFromRoom(socketId: string, slug: string): Promise<void> {
    const room: RoomModel = await this.getRoom(slug)
    room.users = room.users.filter((user: User) => user.socketId !== socketId)
    await this.redisService.hset(`room:${slug}`, ['users', JSON.stringify(room.users), 'currentPlayers', (room.currentPlayers - 1).toString()]);
  }

  async getRooms(): Promise<RoomModel[]> {
    const roomKeys: string[] = await this.redisService.keys('room:*');
    const rooms: RoomModel[] = [];
    for (const roomKey of roomKeys) {
      const roomData = await this.redisService.hgetall(roomKey);
      const room: RoomModel = {
        slug: roomData.slug,
        maxPlayers: parseInt(roomData.maxPlayers, 10),
        currentPlayers: parseInt(roomData.currentPlayers, 10),
        password: roomData.password || '',
        users: JSON.parse(roomData.users || '[]'),
        host: JSON.parse(roomData.host),
        status: roomData.status as GameStatus,
        currentRound: parseInt(roomData.currentRound, 10),
        board: JSON.parse(roomData.board),
        playerHasToPlay: JSON.parse(roomData.playerHasToPlay),
      };
      rooms.push(room);
    }
    return rooms;
  }

  async getRoom(slug: string): Promise<RoomModel> {
    const roomKey: string = `room:${slug}`;
    if (await this.redisService.exists(roomKey) == 0) {
      throw new Error(`La room ${slug} n'existe pas`);
    }
    const roomData = await this.redisService.hgetall(roomKey);
    return {
      maxPlayers: parseInt(roomData.maxPlayers, 10),
      currentPlayers: parseInt(roomData.currentPlayers, 10),
      password: roomData.password || '',
      users: JSON.parse(roomData.users || '[]'),
      host: JSON.parse(roomData.host),
      status: roomData.status as GameStatus,
      currentRound: parseInt(roomData.currentRound, 10),
      board: JSON.parse(roomData.board),
      playerHasToPlay: JSON.parse(roomData.playerHasToPlay),
    } as RoomModel;
  }

  async getRound(slug: string, round: number = null): Promise<RoundModel> {
    const room: RoomModel = await this.getRoom(slug);
    if (round == null) round = room.currentRound;
    if (round > room.currentRound) throw new Error("La manche n'existe pas");
    if (await this.redisService.exists(`room:${slug}:${round}`) == 0) {
      return {
        cards: []
      } as RoundModel;
    }
    const roundData = await this.redisService.hgetall(`room:${slug}:${round}`);
    return {
      cards: JSON.parse(roundData.cards)
    } as RoundModel;
  }

  async gameStatus(slug: string): Promise<string> {
    const room: RoomModel = await this.getRoom(slug);
    return room.status == GameStatus.CHOOSE_CARD || room.status == GameStatus.CHOOSE_SLOT ? 'STARTED' : room.status;
  }

  async usersWithoutCardsInRoom(slug: string): Promise<UserInRoom[]> {
    return await this.getRoomUsersInRoom(slug);
  }

  async getRoomUsersInRoom(slug: string): Promise<UserWithHost[]> {
    const room: RoomModel = await this.getRoom(slug);
    return room.users.map((user: User) => {
      return {
        userId: user.userId,
        username: user.username,
        socketId: user.socketId,
        isHost: user.userId === room.host.userId,
        hasToPlay: user.hasToPlay,
        bullsLost: user.bullsLost,
      }
    }) as UserWithHost[];
  }

  async kickUser(slug: string, userId: string): Promise<void> {
    const room: RoomModel = await this.getRoom(slug);
    const user: User = room.users.find((user: User) => user.userId === userId);
    if (!user) throw new HttpException(`L'utilisateur ${userId} n'existe pas dans la room`, 404);
    await this.removeUserFromRoom(user.socketId, slug);
  }
}




