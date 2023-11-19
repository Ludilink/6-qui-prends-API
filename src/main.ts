import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {MicroserviceOptions, Transport} from "@nestjs/microservices";


async function bootstrap() {
  const app = await NestFactory.create(AppModule,  { cors: true });
  const microserviceOptions: MicroserviceOptions = {
    transport: Transport.REDIS,
    options: {
      host: process.env.REDIS_HOST,
      port: +process.env.REDIS_PORT,
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
    },
  };

  app.connectMicroservice(microserviceOptions);

  await app.startAllMicroservices();

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
