import { Module } from '@nestjs/common';
import { AdminOperationsController } from './admin-operations.controller';

@Module({
  controllers: [AdminOperationsController],
})
export class AdminModule {}
