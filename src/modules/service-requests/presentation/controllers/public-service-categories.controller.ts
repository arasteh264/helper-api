import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

@ApiTags('Service Requests')
@Controller('service-requests')
export class PublicServiceCategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary: 'List active service categories with approved providers',
  })
  @Get('categories')
  getCategories() {
    return this.prisma.skill
      .findMany({
        where: {
          providers: {
            some: {
              providerProfile: {
                verificationStatus: 'APPROVED',
                isAvailable: true,
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              providers: {
                where: {
                  providerProfile: {
                    verificationStatus: 'APPROVED',
                    isAvailable: true,
                  },
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      })
      .then((skills) =>
        skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          providerCount: skill._count.providers,
        })),
      );
  }
}
