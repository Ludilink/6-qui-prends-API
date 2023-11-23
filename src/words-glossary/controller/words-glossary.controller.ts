import {Body, Controller, Delete, Get, Param, Post, Put, Req, UnauthorizedException} from '@nestjs/common';
import {UseGuards, UsePipes} from '@nestjs/common/decorators';
import {JwtAuthGuard} from "../../auth/guards/jwt-auth.guard";
import {WordsGlossaryService} from "../service/words-glossary.service";
import {ValidationPipe} from "@nestjs/common/pipes";
import {WordGlossary} from "../words-glossary.entity";
import {HttpException} from "@nestjs/common/exceptions";
import {WordGlossaryDto} from "../dto/words-glossary.dto";


@Controller('word-glossary')
export class WordsGlossaryController {

  constructor(private wordGlossaryService: WordsGlossaryService) {
  }

  @UseGuards(JwtAuthGuard)
  @Get("/")
  async GetThreeWord(): Promise<{}> {
    let words = await this.wordGlossaryService.GetThreeWord();
    return {"room": words};
  }

  @UseGuards(JwtAuthGuard)
  @UsePipes(ValidationPipe)
  @Post("/")
  async Create(@Body() wordGlossary: WordGlossaryDto): Promise<WordGlossary[]> {
    let allWords: WordGlossary[] = [];
    for (const w of wordGlossary.words) {
      if (await this.wordGlossaryService.checkWord(w.toLowerCase())) continue;
      allWords.push(await this.wordGlossaryService.Create({ word : w.toLowerCase()} as WordGlossary));
    }
    if (allWords.length <= 0) throw new HttpException("Les mots existent déjà", 409);
    return allWords;
  }

  @UseGuards(JwtAuthGuard)
  @Delete("/:id")
  async Delete(@Param('id') id: string) {
    return await this.wordGlossaryService.delete(id);
  }
}
