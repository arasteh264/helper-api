import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ReviewProviderDocumentDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MinLength(3)
  rejectionNote?: string;
}