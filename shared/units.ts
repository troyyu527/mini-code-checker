// Units: inches and feet to millimetres, and display text for measured values.
export const INCH_MM = 25.4;

export function inchesToMm(inches: number): number {
  return inches * INCH_MM;
}

/** A facts quantity says what it measures in its name: "…Mm" is a length, "…M2" an area. */
export function quantityKind(quantity: string): "length" | "area" | "other" {
  if (quantity.endsWith("Mm")) return "length";
  if (quantity.endsWith("M2")) return "area";
  return "other";
}

const round1 = (v: number) => String(Math.round(v * 10) / 10);

/** "762 mm (30 in)" for lengths, "6.5 m² (70 ft²)" for areas. */
export function formatFact(value: number, quantity: string): string {
  const kind = quantityKind(quantity);
  if (kind === "length") return `${round1(value)} mm (${round1(value / INCH_MM)} in)`;
  if (kind === "area") return `${round1(value)} m² (${Math.round(value / 0.09290304)} ft²)`;
  return round1(value);
}