import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { TokenPayload } from '../../domain/services/token-generator.port';
import { PRISMA_SERVICE } from '../../../../infrastructure/database/prisma.service.token';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: TokenPayload): Promise<TokenPayload> {
    const account = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true, status: true },
    });
    if (
      !account ||
      account.status !== 'ACTIVE' ||
      account.role !== payload.role
    ) {
      throw new UnauthorizedException('حساب کاربری فعال نیست');
    }
    return payload;
  }
}
