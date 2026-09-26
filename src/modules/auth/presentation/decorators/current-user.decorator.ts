import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TokenPayload } from '../../domain/services/token-generator.port';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
