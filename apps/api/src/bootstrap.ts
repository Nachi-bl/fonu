import 'reflect-metadata';
import './env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app';
import { ErrorFilter } from './common';
import { allowedOrigins } from './origins';

export async function createApplication() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(helmet());
  app.use(json({ limit: '32kb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: allowedOrigins() });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ErrorFilter());
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Stockroom API').setVersion('1.0').addBearerAuth().build(),
    ),
  );
  try {
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
