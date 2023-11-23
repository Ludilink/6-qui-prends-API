import {Entity, PrimaryGeneratedColumn, Column} from 'typeorm';

@Entity()
export class WordGlossary {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({type: 'varchar', unique: true, nullable: false})
  word: string;
}
