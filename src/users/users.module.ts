import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { User } from './users.entity';
import { forwardRef } from '@nestjs/common/utils';
import {RedisModule} from "../redis/redis.module";

@Module({
    imports: [TypeOrmModule.forFeature([User]), forwardRef(() => AuthModule), forwardRef(() => RedisModule)],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}