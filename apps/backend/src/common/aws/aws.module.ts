import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsSesEmailService } from './ses/ses-email.service';
import { S3Service } from './s3/s3.service';
import { DynamoDbService } from './dynamodb/dynamodb.service';
import { SnsService } from './sns/sns.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AwsSesEmailService, S3Service, SnsService, DynamoDbService],
  exports: [AwsSesEmailService, S3Service, SnsService, DynamoDbService],
})
export class AwsModule {}
