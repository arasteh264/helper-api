import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpsertBankAccountDto {
  @ApiProperty({ description: 'نام صاحب حساب' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  holderName!: string;

  @ApiProperty({ description: 'شماره شبا: IR + ۲۴ رقم (فاصله‌ها حذف می‌شن)' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value,
  )
  @Matches(/^IR\d{24}$/, { message: 'sheba must be IR followed by 24 digits' })
  sheba!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;
}