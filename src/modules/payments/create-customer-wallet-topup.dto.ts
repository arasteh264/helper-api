import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateCustomerWalletTopupDto {
  @ApiProperty({ minimum: 10000, description: 'Amount in toman' })
  @Type(() => Number)
  @IsInt()
  @Min(10_000)
  amountToman!: number;
}
