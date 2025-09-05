import { Module } from '@nestjs/common';
import { CommonController } from './common.controller';
import { ApiKeyService } from '../blockchain/services/api-key.service';

@Module({
  controllers: [CommonController],
  providers: [ApiKeyService]
})
export class CommonModule {}