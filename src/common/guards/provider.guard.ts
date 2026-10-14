import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class ProviderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    return user?.role === 'PROVIDER';
  }
}
