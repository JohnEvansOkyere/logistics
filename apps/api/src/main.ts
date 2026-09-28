import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000",
  });
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, "127.0.0.1");
}

void bootstrap();
