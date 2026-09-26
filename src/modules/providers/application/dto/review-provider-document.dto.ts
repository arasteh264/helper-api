import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum DocumentReviewDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ReviewProviderDocumentDto {
  @ApiProperty({ enum: DocumentReviewDecision })
  @IsEnum(DocumentReviewDecision)
  decision!: DocumentReviewDecision;

  @ApiPropertyOptional({ example: 'کیفیت عکس کارت ملی پایین است' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  rejectionNote?: string;
}