import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class BlogContentBlockDto {
  @ApiProperty({ enum: ['paragraph', 'heading', 'list', 'tip'] })
  @IsIn(['paragraph', 'heading', 'list', 'tip'])
  type!: 'paragraph' | 'heading' | 'list' | 'tip';

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @ValidateIf((block: BlogContentBlockDto) => block.type !== 'list')
  text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @ValidateIf((block: BlogContentBlockDto) => block.type === 'list')
  items?: string[];
}

export class BlogPostFieldsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ description: 'Lowercase URL-safe slug' })
  @IsString()
  @MaxLength(120)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(320)
  excerpt!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  category!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  categorySlug!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  authorName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  authorRole!: string;

  @ApiProperty({ type: [BlogContentBlockDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BlogContentBlockDto)
  content!: BlogContentBlockDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  coverAlt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  coverTint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  canonicalUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED'] })
  @IsIn(['DRAFT', 'PUBLISHED'])
  status!: 'DRAFT' | 'PUBLISHED';
}
