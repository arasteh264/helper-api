import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePortfolioItemDto {
  @ApiPropertyOptional({ example: 'نصب کولر گازی' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({
    example: 'نصب کامل یک دستگاه کولر گازی ۱۸۰۰۰ در آپارتمان مسکونی',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
