// Units: code values (inches, feet, square feet) → the facts' units (mm, m²), and display text.

export const LENGTH_UNITS = { mm: 1, in: 25.4, ft: 304.8 } as const;
export const AREA_UNITS = { m2: 1, ft2: 0.09290304 } as const;
export type LengthUnit = keyof typeof LENGTH_UNITS;
export type AreaUnit = keyof typeof AREA_UNITS;
export type Unit = LengthUnit | AreaUnit;
export const UNITS = ["mm", "in", "ft", "m2", "ft2"] as const satisfies readonly Unit[];

/** A facts quantity says what it measures in its name: "…Mm" is a length, "…M2" an area. */
export function quantityKind(quantity: string): "length" | "area" | "other" {
  if (quantity.endsWith("Mm")) return "length";
  if (quantity.endsWith("M2")) return "area";
  return "other";
}

/** Converts a value to the quantity's unit (mm or m²); null when the unit does not fit (inches for an area). */
export function toFactUnit(value: number, unit: Unit, quantity: string): number | null {
  const kind = quantityKind(quantity);
  if (kind === "length" && unit in LENGTH_UNITS) return value * LENGTH_UNITS[unit as LengthUnit];
  if (kind === "area" && unit in AREA_UNITS) return value * AREA_UNITS[unit as AreaUnit];
  return null;
}

const round1 = (v: number) => String(Math.round(v * 10) / 10);

/** "762 mm (30 in)" for lengths, "6.5 m² (70 ft²)" for areas. */
export function formatFact(value: number, quantity: string): string {
  const kind = quantityKind(quantity);
  if (kind === "length") return `${round1(value)} mm (${round1(value / 25.4)} in)`;
  if (kind === "area") return `${round1(value)} m² (${Math.round(value / AREA_UNITS.ft2)} ft²)`;
  return round1(value);
}
