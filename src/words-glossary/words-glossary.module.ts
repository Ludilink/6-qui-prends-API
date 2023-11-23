import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {WordsGlossaryController} from "./controller/words-glossary.controller";
import {WordsGlossaryService} from "./service/words-glossary.service";
import {WordGlossary} from "./words-glossary.entity";

@Module({
  imports: [TypeOrmModule.forFeature([WordGlossary])],
  controllers: [WordsGlossaryController],
  providers: [WordsGlossaryService],
  exports: [WordsGlossaryService],
})
export class WordsGlossaryModule {
}