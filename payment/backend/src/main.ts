import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { defaultAPIKey } from './middleware/auth';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Trust proxy settings
    app.set('trust proxy', 1);

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
      message: {
        success: false,
        error: 'Too many requests from this IP address',
        retryAfter: 'Please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    app.enableCors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Webhook-Signature']
    });

    // Logging
    app.use(morgan('combined', {
      skip: (req, res) => process.env.NODE_ENV === 'test'
    }));

    // Rate limiting
    app.use(limiter);

    // Body parser
    app.use(express.json({ 
      limit: '10mb',
      verify: (req: any, res: any, buf: Buffer) => {
        req.rawBody = buf;
      }
    }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // app.setGlobalPrefix('api');

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe());

    // Start server
    const PORT = process.env.PORT || 3000;
    await app.listen(PORT);

    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`Default API Key: ${defaultAPIKey}`);
    console.log(`Add API_KEY=${defaultAPIKey} to your .env file`);

    // Graceful shutdown
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`${signal} received, shutting down gracefully`);
        await app.close();
        console.log('Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Error starting application:', error.message);
    process.exit(1);
  }
}

bootstrap();