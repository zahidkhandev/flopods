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

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/exception.filters';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PrismaService } from './prisma/prisma.service';

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
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // CORS configuration
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      /^http:\/\/localhost:\d+$/, // Allow all localhost ports
      /^https?:\/\/.*\.actopod\.dev/, // Production subdomains
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Connect to Prisma database
  const prisma = app.get(PrismaService);
  try {
    await prisma.$connect();
    logger.log('✅ Database connected successfully');
  } catch (error: any) {
    logger.error('❌ Database connection failed', error.message);
    throw new HttpException(
      { message: 'Unable to connect to database', error: error.message },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  // Global validation pipe
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

  // Global interceptors and filters
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger documentation - BEFORE app.listen()
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Actopod API v1')
    .setDescription('AI Workflow Canvas - Multi-LLM Node-Based Platform')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Enter JWT token',
      in: 'header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document, {
    customSiteTitle: 'Actopod API v1 Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Start server
  const port = parseInt(process.env.BACKEND_PORT || '8000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Actopod Backend running on: http://localhost:${port}`);
  logger.log(`📚 API v1 Documentation: http://localhost:${port}/api/v1/docs`);
  logger.log(`🔍 Health Check: http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start application', error);
  process.exit(1);
});
