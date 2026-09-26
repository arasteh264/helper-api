export function isValidSheba(sheba: string): boolean {
  if (!/^IR\d{24}$/.test(sheba)) return false;

  const rearranged = sheba.slice(4) + sheba.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );

  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
