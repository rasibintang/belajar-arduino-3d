/** Modul mendapat daya bila VCC − GND > 3 V. */
export const powered = (ctx, vcc, gnd) => {
  const v = ctx.volts(vcc);
  const g = ctx.volts(gnd);
  return v !== null && g !== null && v - g > 3;
};

/** Kecerahan LED (0..1) dari tegangan kedua kakinya dan hambatan seri. */
export function ledLevel(ctx, anode, cathode, vf, label) {
  const va = ctx.volts(anode);
  const vk = ctx.volts(cathode);
  if (va === null || vk === null) return 0;
  const over = va - vk - vf;
  if (over <= 0) return 0;
  const ohms = ctx.seriesOhms(anode, cathode);
  if (ohms < 10 && label) ctx.warn(`led-${label}`, `${label} tanpa resistor — pada rangkaian nyata LED bisa rusak.`);
  return Math.min(1, ((over / Math.max(ohms, 10)) * 1000) / 12);
}
