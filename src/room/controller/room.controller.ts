import {Body, Controller, Delete, Get, Param, Post} from '@nestjs/common';
import {RoomService} from "../service/room.service";
import {UseGuards, UsePipes} from "@nestjs/common/decorators";
import {JwtAuthGuard} from "../../auth/guards/jwt-auth.guard";
import {CreatedRoomDto} from "../dto/room.dto";
import {ValidationPipe} from "@nestjs/common/pipes";
import {HttpException} from "@nestjs/common/exceptions";

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {
  }

  @UsePipes(ValidationPipe)
  @Post('')
  async createRoom(@Body() roomCreated: CreatedRoomDto): Promise<{}> {
    return await this.roomService.createRoom(roomCreated.maxPlayers, roomCreated.host, roomCreated?.password ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Get('')
  async getRooms(): Promise<{}> {
    return await this.roomService.getRooms();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:slug')
  async getRoom(@Param('slug') slug: string): Promise<{}> {
    try {
      return await this.roomService.getRoom(slug);
    } catch (e) {
      throw new HttpException(e.message, e.status)
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/:slug/close')
  async closeRoom(@Param('slug') slug: string): Promise<{}> {
    try {
      return await this.roomService.closeRoom(slug);
    } catch (e) {
      throw new HttpException(e.message, e.status)
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/:slug/kick/:userId')
  async kickUser(@Param('slug') slug: string, @Param('userId') userId: string): Promise<void> {
    try {
      return await this.roomService.kickUser(slug, userId);
    } catch (e) {
      throw new HttpException(e.message, e.status)
    }
  }
}
