import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { PortfolioItemRepository } from '../../domain/repositories/portfolio-item.repository';
import { PORTFOLIO_ITEM_REPOSITORY } from '../../domain/repositories/portfolio-item.repository.token';
import type { ImageUploader } from '../../../../shared/storage/image-uploader.port';
import { IMAGE_UPLOADER } from '../../../../shared/storage/image-uploader.token';

const MAX_PORTFOLIO_ITEMS = 8;
const MAX_IMAGES_PER_ITEM = 5;

@Injectable()
export class CreatePortfolioItemUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PORTFOLIO_ITEM_REPOSITORY)
    private readonly portfolioItemRepository: PortfolioItemRepository,
    @Inject(IMAGE_UPLOADER)
    private readonly imageUploader: ImageUploader,
  ) {}

  async execute(
    userId: string,
    buffers: Buffer[],
    title?: string,
    description?: string,
  ) {
    if (buffers.length === 0) {
      throw new BadRequestException('At least one image is required');
    }
    if (buffers.length > MAX_IMAGES_PER_ITEM) {
      throw new BadRequestException(
        `You can upload at most ${MAX_IMAGES_PER_ITEM} images per item`,
      );
    }

    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    const currentCount =
      await this.portfolioItemRepository.countByProviderProfileId(profile.id);
    if (currentCount >= MAX_PORTFOLIO_ITEMS) {
      throw new BadRequestException(
        `You can have at most ${MAX_PORTFOLIO_ITEMS} portfolio items`,
      );
    }

    const uploaded = await Promise.all(
      buffers.map((buffer) =>
        this.imageUploader.upload(buffer, 'provider-portfolio'),
      ),
    );

    try {
      return await this.portfolioItemRepository.create({
        providerProfileId: profile.id,
        title,
        description,
        order: currentCount,
        images: uploaded.map((img, i) => ({
          url: img.url,
          publicId: img.publicId,
          order: i,
        })),
      });
    } catch (error) {
      await Promise.all(
        uploaded.map((img) =>
          this.imageUploader.delete(img.publicId).catch(() => undefined),
        ),
      );
      throw error;
    }
  }
}
