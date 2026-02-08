import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend access
  app.enableCors({
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Enable validation with class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error on extra properties
      transform: true, // Transform plain objects to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert primitive types
      },
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`Tent Floor Planner API running on http://localhost:${port}`);
  console.log(`POST /api/calculate - Calculate floor plan scenarios`);
}

bootstrap();
