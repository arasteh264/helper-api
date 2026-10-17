import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PriceAdjustmentItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPriceToman!: number;
}

export class CreatePriceAdjustmentDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PriceAdjustmentItemDto)
  items!: PriceAdjustmentItemDto[];
}
