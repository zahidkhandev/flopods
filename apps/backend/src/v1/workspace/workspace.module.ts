import { Module } from '@nestjs/common';
import { V1WorkspaceController } from './workspace.controller';
import { V1WorkspaceService } from './workspace.service';

@Module({
  controllers: [V1WorkspaceController],
  providers: [V1WorkspaceService],
  exports: [V1WorkspaceService],
})
export class V1WorkspaceModule {}
