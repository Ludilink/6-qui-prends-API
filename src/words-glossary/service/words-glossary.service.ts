import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {HttpException} from "@nestjs/common/exceptions";
import {WordGlossary} from "../words-glossary.entity";

@Injectable()
export class WordsGlossaryService {
  constructor(
    @InjectRepository(WordGlossary)
    private wordGlossaryService: Repository<WordGlossary>,
  ) {
  }

  async GetThreeWord(): Promise<string> {
    const allWords = await this.wordGlossaryService.find();
    if (allWords.length < 3) throw new HttpException("Pas assez de mots dans la base de données", 501);
    return pickRandomElements(allWords);
  }

  async FindOneWord(word: string): Promise<WordGlossary> {
    return await this.wordGlossaryService
      .createQueryBuilder("words_glossary")
      .where("words_glossary.word = :word", {word: word})
      .getOne()
  }

  async Create(wordGlossary: WordGlossary): Promise<WordGlossary> {
    const newWordGlossary: WordGlossary = this.wordGlossaryService.create(wordGlossary);
    return this.wordGlossaryService.save(newWordGlossary);
  }

  async checkWord(word: string): Promise<boolean> {
    const pirateGlossary: WordGlossary = await this.FindOneWord(word);
    return !!pirateGlossary;
  }

  async delete(id: string) {
    let query = await this.wordGlossaryService
      .createQueryBuilder()
      .delete()
      .from(WordGlossary)
      .where("id= :id", {id: id})
      .execute();
    if (query.affected == 0) throw new HttpException("Le mot n'a pas été trouvé", 404);
    return {};
  }
}

function pickRandomElements(arr: WordGlossary[]): string {
  const randomElements: WordGlossary[] = [];
  const shuffledArray = [...arr];
  while (randomElements.length < 3) {
    randomElements.push(shuffledArray.splice(Math.floor(Math.random() * shuffledArray.length), 1)[0]);
  }
  return randomElements.map((element) => element.word).join('-');
}
