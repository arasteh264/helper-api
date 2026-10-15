import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsIn,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BlogContentBlockDto } from './blog-content-block.dto';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';

export class SubmitProviderArticleDto {
  @IsString()
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(320)
  excerpt!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BlogContentBlockDto)
  content!: BlogContentBlockDto[];

  @IsString()
  @MaxLength(2048)
  coverImage!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  coverAlt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  specialtyIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  readingMinutes?: number;
}

export class RateProviderArticleDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

export class ProviderArticleListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all')
  categoryId?: string;

  @IsOptional()
  @IsUUID('all')
  specialtyId?: string;
}

export class AdminProviderArticleListQueryDto extends ProviderArticleListQueryDto {
  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'APPROVED', 'REJECTED'])
  status?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
}

export class ReviewProviderArticleDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string | null;
}
