import {IsNotEmpty} from 'class-validator';

export class WordGlossaryDto {
  @IsNotEmpty({message: "Le mot ne peut pas être vide"})
  words: string[];
}