import { Injectable, type OnModuleInit, type OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@flopods/schema';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const statementTimeoutMs = Number(process.env.PRISMA_STATEMENT_TIMEOUT_MS ?? '30000');
    const idleInTransactionTimeoutMs = Number(process.env.PRISMA_IDLE_TRANSACTION_TIMEOUT_MS ?? '30000');
    const queryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS ?? '30000');

    const adapter = new PrismaPg({
      connectionString,
      statement_timeout: statementTimeoutMs,
      idle_in_transaction_session_timeout: idleInTransactionTimeoutMs,
      query_timeout: queryTimeoutMs,
    });

    super({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
