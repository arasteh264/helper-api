export function normalizeSheba(sheba: string): string {
  const compact = sheba
    .replace(/[۰-۹]/g, (digit) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)),
    )
    .replace(/[٠-٩]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)),
    )
    .replace(/\s+/g, '')
    .toUpperCase();

  if (compact.startsWith('IR')) return compact;
  return /^\d{24}$/.test(compact) ? `IR${compact}` : compact;
}

export function isValidSheba(sheba: string): boolean {
  const normalized = normalizeSheba(sheba);
  if (!/^IR\d{24}$/.test(normalized)) return false;

  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );

  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
