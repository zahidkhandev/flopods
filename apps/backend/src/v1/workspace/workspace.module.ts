import { Module } from '@nestjs/common';
import { V1WorkspaceController } from './workspace.controller';
import { V1WorkspaceService } from './workspace.service';
import { V1NotificationModule } from '../notification/notification.module';
import { V1ApiKeyService } from './services/api-key.service';
import { ApiKeyEncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [V1NotificationModule],
  controllers: [V1WorkspaceController],
  providers: [V1WorkspaceService, V1ApiKeyService, ApiKeyEncryptionService],
  exports: [V1WorkspaceService],
})
export class V1WorkspaceModule {}
