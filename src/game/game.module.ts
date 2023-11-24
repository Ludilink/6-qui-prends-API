import {Module} from '@nestjs/common';
import {forwardRef} from "@nestjs/common/utils";
import {RedisModule} from "../redis/redis.module";
import {GameService} from "./service/game.service";
import {RoomModule} from "../room/room.module";

@Module({
  imports: [forwardRef(() => RedisModule), forwardRef(() => RoomModule)],
  controllers: [],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {
}
