import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { SkillRepository } from '../../domain/repositories/skill.repository';

@Injectable()
export class PrismaSkillRepository implements SkillRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByName(name: string): Promise<{ id: string; name: string }> {
    return this.prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  async findManyByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
    return this.prisma.skill.findMany({
      where: { id: { in: ids } },
    });
  }
}