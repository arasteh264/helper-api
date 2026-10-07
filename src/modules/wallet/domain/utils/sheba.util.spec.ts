import { isValidSheba, normalizeSheba } from './sheba.util';

describe('Sheba utilities', () => {
  const validSheba = 'IR790191234567890123456789';

  it('adds the IR prefix when a valid 24-digit Sheba is entered without it', () => {
    expect(normalizeSheba(validSheba.slice(2))).toBe(validSheba);
    expect(isValidSheba(validSheba.slice(2))).toBe(true);
  });

  it('normalizes Persian digits and whitespace before validation', () => {
    const persianSheba = '۷۹۰۱۹۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹';
    expect(normalizeSheba(` ${persianSheba} `)).toBe(validSheba);
    expect(isValidSheba(` ${persianSheba} `)).toBe(true);
  });

  it('rejects Shebas with an invalid checksum', () => {
    expect(isValidSheba('IR790191234567890123456780')).toBe(false);
  });
});
