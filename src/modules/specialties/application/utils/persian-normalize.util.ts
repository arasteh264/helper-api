const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const ZWNJ = /\u200c/g;

export function normalizePersian(input: string): string {
  let result = input.trim();

  result = result.replace(ZWNJ, '');
  result = result.replace(/ي/g, 'ی');
  result = result.replace(/ك/g, 'ک');

  result = result.replace(/[۰-۹]/g, (digit) =>
    String(PERSIAN_DIGITS.indexOf(digit)),
  );
  result = result.replace(/[٠-٩]/g, (digit) =>
    String(ARABIC_DIGITS.indexOf(digit)),
  );

  return result.toLowerCase();
}