import {CreatedUserDto} from "./users.dto";
import {PartialType} from "@nestjs/swagger";
import {IsOptional} from "class-validator";
import {Role} from "../role.enum";

export class UpdatedUsersDto extends PartialType(CreatedUserDto) {
  @IsOptional()
  role: Role;
}