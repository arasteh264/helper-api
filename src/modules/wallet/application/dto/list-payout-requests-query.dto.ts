import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';

export class ListPayoutRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'REJECTED', 'CANCELLED'])
  status?: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED';
}
