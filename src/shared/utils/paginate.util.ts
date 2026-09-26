import { PaginatedResult } from '../types/paginated-result.type';

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
): PaginatedResult<T> {
  return {
    items,
    total,
  };
}
