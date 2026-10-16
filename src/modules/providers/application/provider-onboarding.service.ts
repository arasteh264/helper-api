import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PASSWORD_HASHER } from '../../users/domain/services/password-hasher.token';
import type { PasswordHasher } from '../../users/domain/services/password-hasher.port';
import { TOKEN_GENERATOR } from '../../auth/domain/services/token-generator.token';
import type { TokenGenerator } from '../../auth/domain/services/token-generator.port';
import { SmsService } from '../../sms/sms.service';
import { CompleteProviderOnboardingDto } from './dto/complete-provider-onboarding.dto';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_SEND_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  callback: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await callback(values[index]);
      }
    }),
  );
  return results;
}

function normalizePhone(value: string): string {
  const asciiDigits = value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  let phone = asciiDigits.replace(/[^\d+]/g, '');

  if (phone.startsWith('+98')) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith('0098')) phone = `0${phone.slice(4)}`;
  else if (/^9\d{9}$/.test(phone)) phone = `0${phone}`;

  if (!/^09\d{9}$/.test(phone)) {
    throw new BadRequestException(
      'شماره موبایل باید معتبر و متعلق به ایران باشد',
    );
  }

  return phone;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ProviderOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
    private readonly smsService: SmsService,
  ) {}

  async createInvitation(
    phoneInput: string,
    adminId: string,
    candidate: { name?: string; specialty?: string } = {},
    resendPending = false,
  ) {
    const phone = normalizePhone(phoneInput);
    const configuredUrl = process.env.PROVIDER_ONBOARDING_URL;
    if (process.env.NODE_ENV === 'production' && !configuredUrl) {
      throw new Error('PROVIDER_ONBOARDING_URL is required in production');
    }
    const onboardingUrl = new URL(
      configuredUrl ?? 'http://localhost:3000/provider/onboarding',
    );
    if (
      process.env.NODE_ENV === 'production' &&
      onboardingUrl.protocol !== 'https:'
    ) {
      throw new Error('PROVIDER_ONBOARDING_URL must use HTTPS in production');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'برای این شماره قبلاً حساب کاربری ساخته شده است',
      );
    }

    const now = new Date();
    const existingInvitation =
      await this.prisma.providerOnboardingInvitation.findFirst({
        where: {
          phone,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
    if (existingInvitation && !resendPending) {
      throw new ConflictException(
        'برای این شماره دعوت‌نامه فعال ارسال شده است؛ از گزینه یادآوری استفاده کنید',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.providerOnboardingInvitation.updateMany({
        where: {
          phone,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      return tx.providerOnboardingInvitation.create({
        data: {
          phone,
          candidateName: candidate.name?.trim() || null,
          specialty: candidate.specialty?.trim() || null,
          tokenHash: hashToken(token),
          expiresAt,
          createdById: adminId,
        },
        select: { id: true, expiresAt: true },
      });
    });

    try {
      onboardingUrl.searchParams.set('token', token);
      await this.smsService.sendNotification(
        phone,
        this.buildInvitationMessage(
          onboardingUrl.toString(),
          candidate.name,
          candidate.specialty,
          resendPending,
        ),
      );
      await this.prisma.providerOnboardingInvitation.update({
        where: { id: invitation.id },
        data: { smsSentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.providerOnboardingInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });
      throw error;
    }

    return {
      message: resendPending
        ? 'یادآوری دعوت‌نامه برای متخصص پیامک شد'
        : 'لینک دعوت برای متخصص پیامک شد',
      id: invitation.id,
      phone,
      expiresAt: invitation.expiresAt,
    };
  }

  async createInvitationBatch(
    items: { phone: string; name?: string; specialty?: string }[],
    adminId: string,
  ) {
    const seenPhones = new Set<string>();
    const prepared: {
      phone: string;
      name?: string;
      specialty?: string;
      duplicate?: boolean;
      invalidMessage?: string;
    }[] = [];

    for (const item of items) {
      try {
        const normalizedPhone = normalizePhone(item.phone);
        const duplicate = seenPhones.has(normalizedPhone);
        if (!duplicate) seenPhones.add(normalizedPhone);
        prepared.push({ ...item, phone: normalizedPhone, duplicate });
      } catch (error) {
        prepared.push({
          ...item,
          invalidMessage:
            error instanceof Error ? error.message : 'شماره موبایل معتبر نیست',
        });
      }
    }

    const results = await mapWithConcurrency(
      prepared,
      INVITATION_SEND_CONCURRENCY,
      async (item) => {
        if (item.invalidMessage) {
          return {
            phone: item.phone,
            success: false,
            message: item.invalidMessage,
          };
        }
        if (item.duplicate) {
          return {
            phone: item.phone,
            success: false,
            message: 'این شماره در فایل تکراری است',
          };
        }

        try {
          const invitation = await this.createInvitation(item.phone, adminId, {
            name: item.name,
            specialty: item.specialty,
          });
          return { ...invitation, success: true };
        } catch (error) {
          return {
            phone: item.phone,
            success: false,
            message:
              error instanceof Error
                ? error.message
                : 'ارسال دعوت‌نامه ناموفق بود',
          };
        }
      },
    );

    return {
      total: results.length,
      sent: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      items: results,
    };
  }

  async remindInvitations(invitationIds: string[], adminId: string) {
    const results = await mapWithConcurrency(
      invitationIds,
      INVITATION_SEND_CONCURRENCY,
      async (id) => {
        try {
          const result = await this.remindInvitation(id, adminId);
          return {
            id,
            phone: result.phone,
            success: true,
            message: result.message,
          };
        } catch (error) {
          return {
            id,
            phone: '',
            success: false,
            message:
              error instanceof Error
                ? error.message
                : 'ارسال یادآوری دعوت‌نامه ناموفق بود',
          };
        }
      },
    );
    return {
      total: results.length,
      sent: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      items: results,
    };
  }

  async remindInvitation(invitationId: string, adminId: string) {
    const invitation =
      await this.prisma.providerOnboardingInvitation.findUnique({
        where: { id: invitationId },
        select: {
          id: true,
          phone: true,
          candidateName: true,
          specialty: true,
          usedAt: true,
          revokedAt: true,
        },
      });
    if (!invitation || invitation.usedAt) {
      throw new NotFoundException('دعوت ثبت‌نام‌نشده پیدا نشد');
    }

    const latestInvitation =
      await this.prisma.providerOnboardingInvitation.findFirst({
        where: {
          phone: invitation.phone,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
    if (latestInvitation?.id !== invitation.id) {
      throw new ConflictException('این دعوت‌نامه دیگر فعال نیست');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { phone: invitation.phone },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'این شماره قبلاً ثبت‌نام کرده است و امکان ارسال یادآوری ندارد',
      );
    }

    return this.createInvitation(
      invitation.phone,
      adminId,
      {
        name: invitation.candidateName ?? undefined,
        specialty: invitation.specialty ?? undefined,
      },
      true,
    );
  }

  private buildInvitationMessage(
    onboardingUrl: string,
    name?: string,
    specialty?: string,
    isReminder = false,
  ): string {
    const greeting = name?.trim() ? `سلام ${name.trim()}، ` : 'سلام، ';
    const specialtyText = specialty?.trim()
      ? ` ثبت‌نام شما برای تخصص ${specialty.trim()} است.`
      : '';
    const action = isReminder
      ? 'برای تکمیل ثبت‌نام همکاری با هلپر، فرم اطلاعات و مدارک را از لینک زیر تکمیل کنید'
      : 'از شما برای همکاری با هلپر دعوت می‌کنیم؛ فرم اطلاعات و مدارک را از لینک زیر تکمیل کنید';
    return `${greeting}${action}.${specialtyText} اعتبار لینک ۷ روز است:\n${onboardingUrl}`;
  }

  async completeOnboarding(input: CompleteProviderOnboardingDto) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const tokenHash = hashToken(input.token);
    const invitation =
      await this.prisma.providerOnboardingInvitation.findUnique({
        where: { tokenHash },
      });
    if (
      !invitation ||
      invitation.usedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new NotFoundException('لینک دعوت نامعتبر یا منقضی شده است');
    }

    const name = input.name.trim();
    const providerAddress = input.providerAddress.trim();
    const bio = input.bio?.trim() || null;
    const skills = [
      ...new Map(
        input.skills
          .map((skill) => skill.trim())
          .filter(Boolean)
          .map((skill) => [skill.toLocaleLowerCase('fa-IR'), skill] as const),
      ).values(),
    ];
    if (skills.length === 0) {
      throw new BadRequestException('حداقل یک مهارت وارد کنید');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { phone: invitation.phone }],
      },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'برای این ایمیل یا شماره موبایل قبلاً حساب کاربری ساخته شده است',
      );
    }

    const activeSpecialties = await this.prisma.specialty.findMany({
      where: { id: { in: input.specialtyIds }, isActive: true },
      select: { id: true },
    });
    if (activeSpecialties.length !== input.specialtyIds.length) {
      throw new BadRequestException(
        'یک یا چند تخصص انتخاب‌شده معتبر یا فعال نیست',
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const userId = randomUUID();
    const providerProfileId = randomUUID();
    const now = new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.providerOnboardingInvitation.updateMany({
          where: {
            id: invitation.id,
            tokenHash,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) {
          throw new NotFoundException(
            'لینک دعوت قبلاً استفاده یا منقضی شده است',
          );
        }

        await tx.user.create({
          data: {
            id: userId,
            name,
            email: normalizedEmail,
            phone: invitation.phone,
            passwordHash,
            role: 'PROVIDER',
            status: 'ACTIVE',
          },
        });
        await tx.providerProfile.create({
          data: {
            id: providerProfileId,
            userId,
            bio,
            providerAddress,
            providerAddressType: input.providerAddressType,
            serviceAreaLatitude: input.serviceAreaLatitude ?? null,
            serviceAreaLongitude: input.serviceAreaLongitude ?? null,
            serviceAreaRadiusKm: input.serviceAreaRadiusKm ?? 10,
            isAvailable: false,
            verificationStatus: 'PENDING',
            isVerified: false,
          },
        });

        await tx.providerSpecialty.createMany({
          data: input.specialtyIds.map((specialtyId) => ({
            providerProfileId,
            specialtyId,
          })),
        });

        for (const skillName of skills) {
          const skill = await tx.skill.upsert({
            where: { name: skillName },
            update: {},
            create: { name: skillName },
            select: { id: true },
          });
          await tx.providerSkill.create({
            data: { providerProfileId, skillId: skill.id },
          });
        }
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'برای این ایمیل یا شماره موبایل قبلاً حساب کاربری ساخته شده است',
        );
      }
      throw error;
    }

    return {
      message:
        'ثبت‌نام متخصص انجام شد؛ مدارک را برای بررسی ادمین بارگذاری کنید',
      accessToken: this.tokenGenerator.generate({
        userId,
        role: 'PROVIDER',
      }),
    };
  }
}
