import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PRISMA_SERVICE } from './prisma.service.token';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: PRISMA_SERVICE, useExisting: PrismaService },
  ],
  exports: [PrismaService, PRISMA_SERVICE],
})
export class DatabaseModule {}
