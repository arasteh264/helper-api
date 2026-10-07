import { Inject, Injectable } from '@nestjs/common';

import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';

const persianDatePartsFormatter = new Intl.DateTimeFormat(
  'en-u-ca-persian-nu-latn',
  {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  },
);

function getPersianMonthParts(date: Date) {
  const parts = persianDatePartsFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Could not calculate Persian calendar month.');
  }
  return { year, month, day };
}

@Injectable()
export class GetAdminProviderInsightsUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute() {
    const now = new Date();
    const monthStarts: Date[] = [];
    for (let daysBack = 0; daysBack <= 400 && monthStarts.length < 12; daysBack += 1) {
      const candidate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - daysBack,
          12,
        ),
      );
      if (getPersianMonthParts(candidate).day === '1') {
        monthStarts.push(candidate);
      }
    }
    if (monthStarts.length !== 12) {
      throw new Error('Could not calculate the previous 12 Persian months.');
    }

    const months = monthStarts.reverse();
    const monthlyRegistrations = new Map<string, number>();
    for (const month of months) {
      const parts = getPersianMonthParts(month);
      monthlyRegistrations.set(`${parts.year}-${parts.month}`, 0);
    }

    const insights = await this.providerProfileRepository.getAdminInsights({
      createdFrom: new Date(months[0].getTime() - 24 * 60 * 60 * 1000),
      createdTo: now,
      limit: 5,
    });

    for (const createdAt of insights.registrationDates) {
      const parts = getPersianMonthParts(createdAt);
      const key = `${parts.year}-${parts.month}`;
      if (monthlyRegistrations.has(key)) {
        monthlyRegistrations.set(
          key,
          (monthlyRegistrations.get(key) ?? 0) + 1,
        );
      }
    }

    return {
      registrations: months.map((month) => {
        const parts = getPersianMonthParts(month);
        return {
          month: month.toISOString(),
          count: monthlyRegistrations.get(`${parts.year}-${parts.month}`) ?? 0,
        };
      }),
      topRated: insights.topRated,
      topCompletedJobs: insights.topCompletedJobs,
    };
  }
}
