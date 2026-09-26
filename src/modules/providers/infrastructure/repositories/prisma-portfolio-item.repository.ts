import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type {
  PortfolioItemRepository,
  PortfolioItemRecord,
  PortfolioItemImageRecord,
  CreatePortfolioItemInput,
} from '../../domain/repositories/portfolio-item.repository';

@Injectable()
export class PrismaPortfolioItemRepository implements PortfolioItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePortfolioItemInput): Promise<PortfolioItemRecord> {
    return this.prisma.portfolioItem.create({
      data: {
        providerProfileId: input.providerProfileId,
        title: input.title ?? null,
        description: input.description ?? null,
        order: input.order,
        images: {
          create: input.images.map((img) => ({
            url: img.url,
            publicId: img.publicId,
            order: img.order,
          })),
        },
      },
      include: { images: { orderBy: { order: 'asc' } } },
    });
  }

  async findById(id: string): Promise<PortfolioItemRecord | null> {
    return this.prisma.portfolioItem.findUnique({
      where: { id },
      include: { images: { orderBy: { order: 'asc' } } },
    });
  }

  async findByProviderProfileId(
    providerProfileId: string,
  ): Promise<PortfolioItemRecord[]> {
    return this.prisma.portfolioItem.findMany({
      where: { providerProfileId },
      orderBy: { order: 'asc' },
      include: { images: { orderBy: { order: 'asc' } } },
    });
  }

  async countByProviderProfileId(providerProfileId: string): Promise<number> {
    return this.prisma.portfolioItem.count({ where: { providerProfileId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.portfolioItem.delete({ where: { id } });
  }

  async addImage(
    portfolioItemId: string,
    image: { url: string; publicId: string; order: number },
  ): Promise<PortfolioItemImageRecord> {
    return this.prisma.portfolioItemImage.create({
      data: {
        portfolioItemId,
        url: image.url,
        publicId: image.publicId,
        order: image.order,
      },
    });
  }

  async findImageById(
    imageId: string,
  ): Promise<PortfolioItemImageRecord | null> {
    return this.prisma.portfolioItemImage.findUnique({
      where: { id: imageId },
    });
  }

  async countImages(portfolioItemId: string): Promise<number> {
    return this.prisma.portfolioItemImage.count({ where: { portfolioItemId } });
  }

  async deleteImage(imageId: string): Promise<void> {
    await this.prisma.portfolioItemImage.delete({ where: { id: imageId } });
  }
}
