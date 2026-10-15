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
  ValidateNested,
} from 'class-validator';

export class InvoiceLineItemDto {
  @IsString()
  @MaxLength(200)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPriceToman!: number;
}

export class CreateInvoiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  items!: InvoiceLineItemDto[];
}
