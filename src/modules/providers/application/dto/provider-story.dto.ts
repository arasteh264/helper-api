import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProviderStoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  uploadedPublicId: string;

  @IsIn(['IMAGE', 'VIDEO'])
  mediaType: 'IMAGE' | 'VIDEO';

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  specialtyId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  overlayText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  overlayColor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(48)
  overlayFontSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  overlayPositionX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  overlayPositionY?: number;
}

export class UpdateProviderStoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  uploadedPublicId?: string;

  @IsOptional()
  @IsIn(['IMAGE', 'VIDEO'])
  mediaType?: 'IMAGE' | 'VIDEO';

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  specialtyId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  overlayText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  overlayColor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(48)
  overlayFontSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  overlayPositionX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  overlayPositionY?: number;
}

export class PrepareStoryUploadDto {
  @IsIn(['IMAGE', 'VIDEO'])
  mediaType: 'IMAGE' | 'VIDEO';
}

export class ProviderStoryResponseDto {
  id: string;
  title: string;
  description?: string;
  specialtyId?: string;
  specialtyName?: string;
  specialtySlug?: string;
  specialtyGroupName?: string;
  overlayText?: string;
  overlayColor: string;
  overlayFontSize: number;
  overlayPositionX: number;
  overlayPositionY: number;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  isPaid: boolean;
  priceToman?: number;
  monetizationStatus:
    'FREE' | 'PENDING_ADMIN_SETUP' | 'PAYMENT_REQUIRED' | 'PAID';
  submittedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  viewsCount?: number;
  uniqueViewers?: number;
}

export class ProviderStoryListResponseDto {
  stories: ProviderStoryResponseDto[];
  availableSpecialties: {
    id: string;
    name: string;
    slug: string;
    groupName: string;
  }[];
  videoMaxSizeMB: number;
  canCreateStory: boolean;
  total: number;
  page: number;
  pageSize: number;
}

export class ProviderStoryStatsDto {
  storyId: string;
  viewsCount: number;
  uniqueViewers: number;
  lastUpdatedAt: Date;
}
