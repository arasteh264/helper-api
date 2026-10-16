import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

type RequestWithUser = {
  user?: {
    role?: string;
  };
};

@Injectable()
export class ProviderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return user?.role === 'PROVIDER';
  }
}
