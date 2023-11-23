import {Controller, Get} from '@nestjs/common';
import {GameService} from "../service/game.service";
import {JwtAuthGuard} from "../../auth/guards/jwt-auth.guard";
import {UseGuards} from "@nestjs/common/decorators";

@UseGuards(JwtAuthGuard)
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {
  }

  @Get('cards')
  async getCards(): Promise<{}> {
    return await this.gameService.getCards();
  }

  @Get('random-cards')
  async flushCards(): Promise<{}> {
    return await this.gameService.flushCards();
  }
}
