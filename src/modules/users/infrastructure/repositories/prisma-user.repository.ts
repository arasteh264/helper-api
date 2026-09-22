import { Injectable } from '@nestjs/common';
import {
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from '../../../../../generated/prisma/enums';
import { User } from '../../domain/entities/user.entity';
import type { UserRepository } from '../../domain/repositories/user.repository';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { UserRole } from '../../domain/entities/user-role.enum';
import { UserStatus } from '../../domain/entities/user-status.enum';
import { buildPaginatedResult } from '../../../../shared/utils/paginate.util';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role as unknown as PrismaUserRole,
        status: user.status as unknown as PrismaUserStatus,
        passwordHash: user.passwordHash,
        otpCode: user.otpCode,
        otpExpiresAt: user.otpExpiresAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { phone },
    });

    if (!user) {
      return null;
    }

    return User.reconstitute(
      user.id,
      user.name,
      user.email,
      user.phone,
      user.role as UserRole,
      user.status as UserStatus,
      user.passwordHash,
      user.googleId,
      user.otpCode,
      user.otpExpiresAt,
      user.resetToken,
      user.resetTokenExpiry,
      user.createdAt,
      user.updatedAt,
    );
  }

  async findAll(params: { page: number; pageSize: number; search?: string }) {
    const { page, pageSize, search } = params;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = rows.map((user) =>
      User.reconstitute(
        user.id,
        user.name,
        user.email,
        user.phone,
        user.role as UserRole,
        user.status as UserStatus,
        user.passwordHash,
        user.googleId,
        user.otpCode,
        user.otpExpiresAt,
        user.resetToken,
        user.resetTokenExpiry,
        user.createdAt,
        user.updatedAt,
      ),
    );

    return buildPaginatedResult(items, total);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return User.reconstitute(
      user.id,
      user.name,
      user.email,
      user.phone,
      user.role as UserRole,
      user.status as UserStatus,
      user.passwordHash,
      user.googleId,
      user.otpCode,
      user.otpExpiresAt,
      user.resetToken,
      user.resetTokenExpiry,
      user.createdAt,
      user.updatedAt,
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return User.reconstitute(
      user.id,
      user.name,
      user.email,
      user.phone,
      user.role as UserRole,
      user.status as UserStatus,
      user.passwordHash,
      user.googleId,
      user.otpCode,
      user.otpExpiresAt,
      user.resetToken,
      user.resetTokenExpiry,
      user.createdAt,
      user.updatedAt,
    );
  }

  async update(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status as unknown as PrismaUserStatus,
        passwordHash: user.passwordHash,
        otpCode: user.otpCode,
        otpExpiresAt: user.otpExpiresAt,
        resetToken: user.resetToken,
        resetTokenExpiry: user.resetTokenExpiry,
        updatedAt: user.updatedAt,
      },
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token },
    });

    if (!user) {
      return null;
    }

    return User.reconstitute(
      user.id,
      user.name,
      user.email,
      user.phone,
      user.role as UserRole,
      user.status as UserStatus,
      user.passwordHash,
      user.googleId,
      user.otpCode,
      user.otpExpiresAt,
      user.resetToken,
      user.resetTokenExpiry,
      user.createdAt,
      user.updatedAt,
    );
  }
}
