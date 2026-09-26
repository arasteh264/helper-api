import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { IMAGE_UPLOADER } from '@/shared/storage/image-uploader.token';
import type { ImageUploader } from '@/shared/storage/image-uploader.port';
import { PORTFOLIO_ITEM_REPOSITORY } from '../../domain/repositories/portfolio-item.repository.token';
import type { PortfolioItemRepository } from '../../domain/repositories/portfolio-item.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';

@Injectable()
export class DeletePortfolioItemUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PORTFOLIO_ITEM_REPOSITORY)
    private readonly portfolioItemRepository: PortfolioItemRepository,
    @Inject(IMAGE_UPLOADER)
    private readonly imageUploader: ImageUploader,
  ) {}

  async execute(userId: string, itemId: string): Promise<void> {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    const item = await this.portfolioItemRepository.findById(itemId);
    if (!item) throw new NotFoundException('Portfolio item not found');
    if (item.providerProfileId !== profile.id) {
      throw new ForbiddenException('You do not own this portfolio item');
    }

    await this.portfolioItemRepository.delete(itemId);

    await Promise.all(
      item.images.map((img) =>
        this.imageUploader.delete(img.publicId).catch(() => undefined),
      ),
    );
  }
}
