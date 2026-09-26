import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { PortfolioItemRepository } from '../../domain/repositories/portfolio-item.repository';
import { PORTFOLIO_ITEM_REPOSITORY } from '../../domain/repositories/portfolio-item.repository.token';
import type { ImageUploader } from '../../../../shared/storage/image-uploader.port';
import { IMAGE_UPLOADER } from '../../../../shared/storage/image-uploader.token';

const MAX_IMAGES_PER_ITEM = 5;

@Injectable()
export class AddImageToPortfolioItemUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PORTFOLIO_ITEM_REPOSITORY)
    private readonly portfolioItemRepository: PortfolioItemRepository,
    @Inject(IMAGE_UPLOADER)
    private readonly imageUploader: ImageUploader,
  ) {}

  async execute(userId: string, itemId: string, buffer: Buffer) {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    const item = await this.portfolioItemRepository.findById(itemId);
    if (!item) throw new NotFoundException('Portfolio item not found');
    if (item.providerProfileId !== profile.id) {
      throw new ForbiddenException('You do not own this portfolio item');
    }

    const currentCount = await this.portfolioItemRepository.countImages(itemId);
    if (currentCount >= MAX_IMAGES_PER_ITEM) {
      throw new BadRequestException(
        `You can have at most ${MAX_IMAGES_PER_ITEM} images per item`,
      );
    }

    const { url, publicId } = await this.imageUploader.upload(
      buffer,
      'provider-portfolio',
    );

    try {
      return await this.portfolioItemRepository.addImage(itemId, {
        url,
        publicId,
        order: currentCount,
      });
    } catch (error) {
      await this.imageUploader.delete(publicId).catch(() => undefined);
      throw error;
    }
  }
}
