import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPriceAdjustmentDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
