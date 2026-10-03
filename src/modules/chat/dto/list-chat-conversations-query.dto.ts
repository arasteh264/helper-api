import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';

export class ListChatConversationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'CLOSED'])
  status?: 'ACTIVE' | 'PAUSED' | 'CLOSED';
}
