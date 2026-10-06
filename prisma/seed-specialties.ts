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

const specialtyGroups = [
  { name: 'ساختمان و بازسازی', slug: 'building-renovation', sortOrder: 1 },
  { name: 'تعمیرات لوازم', slug: 'appliance-repair', sortOrder: 2 },
  { name: 'نظافت', slug: 'cleaning-services', sortOrder: 3 },
  { name: 'حمل‌ونقل', slug: 'transportation', sortOrder: 4 },
  { name: 'خدمات زیبایی', slug: 'beauty-services', sortOrder: 5 },
  { name: 'خدمات باغبانی', slug: 'gardening-services', sortOrder: 6 },
  { name: 'نصب و راه‌اندازی', slug: 'installation-services', sortOrder: 7 },
  { name: 'مراقبت و پرستاری', slug: 'care-services', sortOrder: 8 },
  { name: 'خدمات آموزشی', slug: 'education-services', sortOrder: 9 },
  { name: 'خدمات خودرو', slug: 'automotive-services', sortOrder: 10 },
] as const;

const specialtiesByGroup = {
  'building-renovation': [
    { name: 'نصب کاغذ دیواری', slug: 'wallpaper-installation' },
    { name: 'عایق‌کاری و آب‌بندی', slug: 'building-waterproofing' },
    { name: 'گچ‌کاری و ترمیم دیوار', slug: 'plastering-and-wall-repair' },
    { name: 'نصب کف‌پوش', slug: 'flooring-installation' },
    { name: 'نقاشی ساختمان', slug: 'house-painting' },
    { name: 'کاشی‌کاری و سرامیک', slug: 'tiling-and-ceramics' },
    { name: 'بنایی و دیوارچینی', slug: 'masonry-and-bricklaying' },
    { name: 'اجرای سقف کاذب', slug: 'false-ceiling-installation' },
    { name: 'تعمیر و تعویض در و پنجره', slug: 'door-window-repair' },
    { name: 'کابینت و کمد دیواری', slug: 'cabinet-and-wardrobe' },
    { name: 'لوله‌کشی و تعمیرات آب', slug: 'plumbing-repair' },
  ],
  'appliance-repair': [
    { name: 'تعمیر ماشین ظرفشویی', slug: 'dishwasher-repair' },
    { name: 'تعمیر مایکروویو', slug: 'microwave-repair' },
    { name: 'تعمیر جاروبرقی', slug: 'vacuum-cleaner-repair' },
    { name: 'تعمیر ماشین لباسشویی', slug: 'washing-machine-repair' },
    { name: 'تعمیر یخچال و فریزر', slug: 'refrigerator-freezer-repair' },
    { name: 'تعمیر کولر گازی', slug: 'air-conditioner-repair' },
    { name: 'تعمیر اجاق گاز و فر', slug: 'stove-and-oven-repair' },
    { name: 'تعمیر تلویزیون', slug: 'television-repair' },
    { name: 'تعمیر آب‌گرم‌کن', slug: 'water-heater-repair' },
    { name: 'تعمیر چرخ خیاطی', slug: 'sewing-machine-repair' },
  ],
  'cleaning-services': [
    { name: 'قالیشویی و شست‌وشوی فرش', slug: 'carpet-cleaning' },
    { name: 'نظافت شیشه و پنجره', slug: 'window-cleaning' },
    { name: 'نظافت پس از بازسازی', slug: 'post-renovation-cleaning' },
    { name: 'نظافت منزل', slug: 'home-cleaning' },
    { name: 'نظافت محل کار و دفتر', slug: 'office-cleaning' },
    { name: 'مبل‌شویی و شست‌وشوی صندلی', slug: 'upholstery-cleaning' },
    { name: 'تشک‌شویی', slug: 'mattress-cleaning' },
    { name: 'نظافت راه‌پله و مشاعات', slug: 'stairwell-cleaning' },
    { name: 'شست‌وشوی پرده', slug: 'curtain-cleaning' },
    { name: 'نظافت آشپزخانه و سرویس بهداشتی', slug: 'kitchen-bathroom-cleaning' },
  ],
  transportation: [
    { name: 'اسباب‌کشی محل کار', slug: 'office-moving' },
    { name: 'حمل بار با وانت', slug: 'pickup-truck-transport' },
    { name: 'اسباب‌کشی بین‌شهری', slug: 'intercity-moving' },
    { name: 'اسباب‌کشی منزل', slug: 'home-moving' },
    { name: 'بسته‌بندی اثاثیه', slug: 'moving-packing' },
    { name: 'حمل اثاثیه سنگین', slug: 'heavy-furniture-transport' },
    { name: 'کارگر جابه‌جایی و تخلیه بار', slug: 'moving-loading-unloading' },
    { name: 'حمل بار با کامیون', slug: 'truck-cargo-transport' },
    { name: 'حمل خرده‌بار شهری', slug: 'local-small-cargo' },
    { name: 'چیدمان و بازکردن اثاثیه', slug: 'furniture-assembly-moving' },
  ],
  'beauty-services': [
    { name: 'رنگ و مش مو', slug: 'hair-coloring' },
    { name: 'پاک‌سازی و مراقبت پوست', slug: 'facial-skincare' },
    { name: 'اصلاح و مرتب‌سازی ابرو', slug: 'eyebrow-grooming' },
    { name: 'کوتاهی و آرایش مو', slug: 'haircut-and-styling' },
    { name: 'میکاپ و گریم', slug: 'makeup-and-beauty' },
    { name: 'کاشت و طراحی ناخن', slug: 'nail-care-and-design' },
    { name: 'خدمات مژه', slug: 'eyelash-services' },
    { name: 'آرایش عروس', slug: 'bridal-makeup' },
    { name: 'اصلاح و پیرایش آقایان', slug: 'mens-grooming' },
    { name: 'بافت و اکستنشن مو', slug: 'hair-braiding-and-extensions' },
  ],
  'gardening-services': [
    { name: 'نگهداری و رسیدگی به باغچه', slug: 'garden-maintenance' },
    { name: 'کاشت درخت و گیاه', slug: 'tree-and-planting' },
    { name: 'سم‌پاشی فضای سبز', slug: 'garden-pest-control' },
    { name: 'هرس درخت و درختچه', slug: 'tree-and-shrub-pruning' },
    { name: 'طراحی فضای سبز', slug: 'landscape-design' },
    { name: 'چمن‌کاری و ترمیم چمن', slug: 'lawn-installation-and-repair' },
    { name: 'نصب و تعمیر آبیاری', slug: 'irrigation-installation-repair' },
    { name: 'نگهداری گل و گیاه آپارتمانی', slug: 'indoor-plant-care' },
    { name: 'رسیدگی به گلخانه', slug: 'greenhouse-maintenance' },
    { name: 'ساخت و نگهداری روف‌گاردن', slug: 'rooftop-garden-maintenance' },
  ],
  'installation-services': [
    { name: 'نصب دستگاه تصفیه آب', slug: 'water-purifier-installation' },
    { name: 'نصب و تعویض روشنایی', slug: 'lighting-installation' },
    { name: 'نصب تجهیزات خانه هوشمند', slug: 'smart-home-installation' },
    { name: 'نصب کولر گازی و اسپلیت', slug: 'air-conditioner-installation' },
    { name: 'نصب دوربین مداربسته', slug: 'cctv-installation' },
    { name: 'نصب و راه‌اندازی شبکه', slug: 'network-installation' },
    { name: 'نصب پرده و کرکره', slug: 'curtain-and-blind-installation' },
    { name: 'نصب قفل و دستگیره در', slug: 'door-lock-installation' },
    { name: 'مونتاژ و نصب مبلمان', slug: 'furniture-assembly' },
    { name: 'نصب آنتن و تجهیزات گیرنده', slug: 'antenna-installation' },
  ],
  'care-services': [
    { name: 'همراهی و مراقبت روزانه از سالمند', slug: 'elderly-companionship' },
    { name: 'نگهداری ساعتی از کودک', slug: 'babysitting' },
    { name: 'مراقبت روزانه از نوزاد', slug: 'newborn-care' },
    { name: 'پرستاری و مراقبت در منزل', slug: 'home-nursing-care' },
    { name: 'همراهی سالمند برای امور روزانه', slug: 'elderly-daily-assistance' },
    { name: 'مراقبت از کودک در منزل', slug: 'in-home-childcare' },
    { name: 'همراهی بیمار در منزل', slug: 'patient-home-companionship' },
    { name: 'مراقبت شبانه از سالمند', slug: 'overnight-elderly-care' },
    { name: 'همراهی کودک در رفت‌وآمد', slug: 'child-transport-companionship' },
    { name: 'مراقبت ساعتی از سالمند', slug: 'hourly-elderly-care' },
  ],
  'education-services': [
    { name: 'آمادگی آزمون و کنکور', slug: 'exam-preparation' },
    { name: 'آموزش کامپیوتر و مهارت‌های دیجیتال', slug: 'computer-training' },
    { name: 'آموزش هنر و نقاشی', slug: 'art-and-painting-lessons' },
    { name: 'تدریس خصوصی زبان', slug: 'private-language-lessons' },
    { name: 'تدریس خصوصی ریاضی', slug: 'private-math-lessons' },
    { name: 'آموزش موسیقی', slug: 'music-lessons' },
    { name: 'آموزش برنامه‌نویسی', slug: 'programming-lessons' },
    { name: 'کمک‌درسی و رفع اشکال مدرسه', slug: 'school-tutoring' },
    { name: 'آموزش نرم‌افزارهای تخصصی', slug: 'professional-software-training' },
    { name: 'آموزش خیاطی و هنرهای دستی', slug: 'sewing-and-handicrafts-lessons' },
  ],
  'automotive-services': [
    { name: 'باتری‌به‌باتری و امداد باتری', slug: 'car-battery-assistance' },
    { name: 'تعویض لاستیک در محل', slug: 'mobile-tire-service' },
    { name: 'کارواش و صفرشویی خودرو', slug: 'car-detailing' },
    { name: 'تعویض روغن در محل', slug: 'mobile-oil-change' },
    { name: 'عیب‌یابی و دیاگ خودرو', slug: 'car-diagnostics' },
    { name: 'مکانیک سیار', slug: 'mobile-car-mechanic' },
    { name: 'صافکاری و نقاشی خودرو', slug: 'car-bodywork-and-paint' },
    { name: 'تعمیر شیشه و چراغ خودرو', slug: 'car-glass-and-light-repair' },
    { name: 'سرویس و تعمیر ترمز', slug: 'brake-service-and-repair' },
    { name: 'تنظیم موتور خودرو', slug: 'engine-tuning' },
  ],
} as const;

async function main() {
  let created = 0;
  let skipped = 0;

  for (const group of specialtyGroups) {
    await prisma.specialtyGroup.upsert({
      where: { slug: group.slug },
      update: {
        name: group.name,
        sortOrder: group.sortOrder,
        isActive: true,
      },
      create: {
        name: group.name,
        slug: group.slug,
        sortOrder: group.sortOrder,
        isActive: true,
      },
    });
  }

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
