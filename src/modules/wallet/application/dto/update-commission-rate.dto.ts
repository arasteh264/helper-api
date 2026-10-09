import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateCommissionRateDto {
  @ApiProperty({ example: 10, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate!: number;

  @ApiProperty({ description: 'دلیل تغییر نرخ برای سابقه‌ی مدیران' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
