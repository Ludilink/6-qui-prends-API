import {Module} from '@nestjs/common';
import {RoomController} from './controller/room.controller';
import {RoomService} from './service/room.service';
import {forwardRef} from "@nestjs/common/utils";
import {RedisModule} from "../redis/redis.module";
import {WordsGlossaryModule} from "../words-glossary/words-glossary.module";

@Module({
  imports: [forwardRef(() => RedisModule), forwardRef(() => WordsGlossaryModule)],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService]
})
export class RoomModule {
}
