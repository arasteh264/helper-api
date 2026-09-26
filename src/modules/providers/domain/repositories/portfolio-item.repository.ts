export interface PortfolioItemImageRecord {
  id: string;
  portfolioItemId: string;
  url: string;
  publicId: string;
  order: number;
  createdAt: Date;
}

export interface PortfolioItemRecord {
  id: string;
  providerProfileId: string;
  title: string | null;
  description: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  images: PortfolioItemImageRecord[];
}

export interface CreatePortfolioItemInput {
  providerProfileId: string;
  title?: string | null;
  description?: string | null;
  order: number;
  images: { url: string; publicId: string; order: number }[];
}

export interface PortfolioItemRepository {
  create(input: CreatePortfolioItemInput): Promise<PortfolioItemRecord>;
  findById(id: string): Promise<PortfolioItemRecord | null>;
  findByProviderProfileId(
    providerProfileId: string,
  ): Promise<PortfolioItemRecord[]>;
  countByProviderProfileId(providerProfileId: string): Promise<number>;
  delete(id: string): Promise<void>;
  addImage(
    portfolioItemId: string,
    image: { url: string; publicId: string; order: number },
  ): Promise<PortfolioItemImageRecord>;
  findImageById(imageId: string): Promise<PortfolioItemImageRecord | null>;
  countImages(portfolioItemId: string): Promise<number>;
  deleteImage(imageId: string): Promise<void>;
}
