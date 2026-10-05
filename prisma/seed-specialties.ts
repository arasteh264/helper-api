import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed specialties');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const specialtiesByGroup = {
  'building-renovation': [
    { name: 'نصب کاغذ دیواری', slug: 'wallpaper-installation' },
    { name: 'عایق‌کاری و آب‌بندی', slug: 'building-waterproofing' },
    { name: 'گچ‌کاری و ترمیم دیوار', slug: 'plastering-and-wall-repair' },
    { name: 'نصب کف‌پوش', slug: 'flooring-installation' },
  ],
  'appliance-repair': [
    { name: 'تعمیر ماشین ظرفشویی', slug: 'dishwasher-repair' },
    { name: 'تعمیر مایکروویو', slug: 'microwave-repair' },
    { name: 'تعمیر جاروبرقی', slug: 'vacuum-cleaner-repair' },
  ],
  'cleaning-services': [
    { name: 'قالیشویی و شست‌وشوی فرش', slug: 'carpet-cleaning' },
    { name: 'نظافت شیشه و پنجره', slug: 'window-cleaning' },
    { name: 'نظافت پس از بازسازی', slug: 'post-renovation-cleaning' },
  ],
  transportation: [
    { name: 'اسباب‌کشی محل کار', slug: 'office-moving' },
    { name: 'حمل بار با وانت', slug: 'pickup-truck-transport' },
    { name: 'اسباب‌کشی بین‌شهری', slug: 'intercity-moving' },
  ],
  'beauty-services': [
    { name: 'رنگ و مش مو', slug: 'hair-coloring' },
    { name: 'پاک‌سازی و مراقبت پوست', slug: 'facial-skincare' },
    { name: 'اصلاح و مرتب‌سازی ابرو', slug: 'eyebrow-grooming' },
  ],
  'gardening-services': [
    { name: 'نگهداری و رسیدگی به باغچه', slug: 'garden-maintenance' },
    { name: 'کاشت درخت و گیاه', slug: 'tree-and-planting' },
    { name: 'سم‌پاشی فضای سبز', slug: 'garden-pest-control' },
  ],
  'installation-services': [
    { name: 'نصب دستگاه تصفیه آب', slug: 'water-purifier-installation' },
    { name: 'نصب و تعویض روشنایی', slug: 'lighting-installation' },
    { name: 'نصب تجهیزات خانه هوشمند', slug: 'smart-home-installation' },
  ],
  'care-services': [
    { name: 'همراهی و مراقبت روزانه از سالمند', slug: 'elderly-companionship' },
    { name: 'نگهداری ساعتی از کودک', slug: 'babysitting' },
    { name: 'مراقبت روزانه از نوزاد', slug: 'newborn-care' },
  ],
  'education-services': [
    { name: 'آمادگی آزمون و کنکور', slug: 'exam-preparation' },
    { name: 'آموزش کامپیوتر و مهارت‌های دیجیتال', slug: 'computer-training' },
    { name: 'آموزش هنر و نقاشی', slug: 'art-and-painting-lessons' },
  ],
  'automotive-services': [
    { name: 'باتری‌به‌باتری و امداد باتری', slug: 'car-battery-assistance' },
    { name: 'تعویض لاستیک در محل', slug: 'mobile-tire-service' },
    { name: 'کارواش و صفرشویی خودرو', slug: 'car-detailing' },
  ],
} as const;

async function main() {
  let created = 0;
  let skipped = 0;

  for (const [groupSlug, specialties] of Object.entries(specialtiesByGroup)) {
    const group = await prisma.specialtyGroup.findUnique({
      where: { slug: groupSlug },
      select: { id: true },
    });
    if (!group) {
      throw new Error(
        `Cannot seed specialties: required group "${groupSlug}" does not exist`,
      );
    }

    const existingSpecialties = await prisma.specialty.findMany({
      where: { groupId: group.id },
      select: { slug: true, sortOrder: true },
    });
    let sortOrder = existingSpecialties.reduce(
      (maximum, specialty) => Math.max(maximum, specialty.sortOrder),
      0,
    );

    for (const specialty of specialties) {
      const existing = await prisma.specialty.findUnique({
        where: { slug: specialty.slug },
        select: { id: true, groupId: true },
      });
      if (existing) {
        if (existing.groupId !== group.id) {
          throw new Error(
            `Specialty slug "${specialty.slug}" already belongs to another group`,
          );
        }
        skipped += 1;
        continue;
      }

      sortOrder += 1;
      await prisma.specialty.create({
        data: {
          groupId: group.id,
          name: specialty.name,
          slug: specialty.slug,
          sortOrder,
          isActive: true,
          pricingMode: 'QUOTE',
        },
      });
      created += 1;
    }
  }

  console.log(
    `Created ${created} specialties; kept ${skipped} existing slugs unchanged.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Specialty seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
