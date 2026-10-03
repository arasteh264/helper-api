import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class AcceptServiceRequestDto {
  @ApiProperty({ description: 'Final offered price in toman', example: 750000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  proposedPriceToman?: number;

  @ApiProperty({
    description: 'Estimated hours for HOURLY specialties',
    example: 3,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(1000)
  estimatedHours?: number;
}
