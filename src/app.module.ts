import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {TypeOrmModule, TypeOrmModuleAsyncOptions} from '@nestjs/typeorm';
import { User } from './users/users.entity';
import { UsersModule } from './users/users.module';
import {RedisModule} from "./redis/redis.module";
import {APP_FILTER} from '@nestjs/core';
import {AuthExceptionFilter} from "./auth/exception-filter/exception-filter";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env']
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: +configService.get<number>('POSTGRES_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DATABASE'),
        entities: [User],
        synchronize: true,
        extra: {
          ssl: configService.get('POSTGRES_SSL') === 'true',
        }
      }),
      inject: [ConfigService],
    } as TypeOrmModuleAsyncOptions),
    UsersModule,
    RedisModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter,
    }
  ],
})
export class AppModule {
}
