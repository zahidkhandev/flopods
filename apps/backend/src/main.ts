import 'tsconfig-paths/register';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  ClassSerializerInterceptor,
  HttpException,
  HttpStatus,
  ValidationPipe,
  VersioningType,
  Logger,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/exception.filters';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaService } from './prisma/prisma.service';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../..', '.env') });

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): { property: string; constraints: Record<string, string> }[] {
  const result: { property: string; constraints: Record<string, string> }[] = [];

  for (const error of errors) {
    const propertyPath = parentPath
      ? Array.isArray(error)
        ? `${parentPath}[${error.property}]`
        : `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      result.push({
        property: propertyPath,
        constraints: error.constraints,
      });
    }

    if (error.children && error.children.length > 0) {
      const childPathPrefix = Array.isArray(error) ? `${propertyPath}` : `${propertyPath}`;
      result.push(...flattenValidationErrors(error.children, childPathPrefix));
    }
  }

  return result;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;

  if (httpProxy || httpsProxy) {
    logger.log(`🔌 Proxy configured: ${httpProxy || httpsProxy}`);
  } else {
    logger.log('🔌 No proxy configured (direct connection)');
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.use(helmet());
  app.use(compression());

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      /^http:\/\/localhost:\d+$/,
      /^https?:\/\/.*\.flopods\.dev/,
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const prisma = app.get(PrismaService);
  try {
    await prisma.$connect();
    logger.log('Database connected successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Database connection failed', errorMessage);
    throw new HttpException(
      { message: 'Unable to connect to database', error: errorMessage },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      forbidNonWhitelisted: true,
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        const flattened = flattenValidationErrors(validationErrors);
        return new HttpException(
          {
            message: 'Validation failed',
            errors: flattened,
          },
          HttpStatus.BAD_REQUEST,
        );
      },
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Flopods API v1')
    .setDescription('AI Workflow Canvas - Multi-LLM Node-Based Platform')
    .setVersion('1.0')
    .setContact('Flopods', 'https://flopods.com', 'support@flopods.com')
    .addServer('http://localhost:8000', 'Local')
    .addServer('https://api.flopods.com', 'Production')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Enter JWT token',
      in: 'header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, { deepScanRoutes: true });
  SwaggerModule.setup('api/v1/docs', app, document, {
    customSiteTitle: 'Flopods API v1 Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  const port = parseInt(process.env.BACKEND_PORT || '8000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Flopods Backend running on: http://localhost:${port}`);
  logger.log(`📚 API v1 Documentation: http://localhost:${port}/api/v1/docs`);
  logger.log(`🔍 Health Check: http://localhost:${port}/api/v1/health`);
  logger.log(`🔌 WebSocket: ws://localhost:${port}/notifications`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error('❌ Failed to start application', errorMessage);
  process.exit(1);
});
