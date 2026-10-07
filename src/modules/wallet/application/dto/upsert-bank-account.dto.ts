import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizeSheba } from '../../domain/utils/sheba.util';

export class UpsertBankAccountDto {
  @ApiProperty({ description: 'نام صاحب حساب' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  holderName!: string;

  @ApiProperty({ description: 'شماره شبا: ۲۴ رقم، با یا بدون پیشوند IR' })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeSheba(value) : value,
  )
  @Matches(/^(?:IR)?\d{24}$/, {
    message: 'شماره شبا باید ۲۴ رقم داشته باشد؛ پیشوند IR اختیاری است',
  })
  sheba!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;
}
