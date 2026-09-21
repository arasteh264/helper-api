import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminCreditWalletDto {
  @ApiProperty({ description: 'مبلغ به تومان (عدد صحیح)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amount!: number;

  @ApiProperty({ description: 'دلیل واریز (برای ردیابی ادمین‌ها)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description!: string;
}