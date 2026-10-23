// Terjemahan spesifikasi komponen sandbox (src/components): nama, keterangan, label props
// beserta opsi & satuannya, dan nama pin. Teks sumber tetap bahasa Indonesia.
import { lang } from './index.js';
import { tr } from './parts.js';

const pin = (p) => ({ ...p, name: tr(p.name) });
const prop = (p) => ({
  ...p,
  label: tr(p.label),
  unit: tr(p.unit),
  options: p.options?.map((o) => ({ ...o, label: tr(o.label) })),
});

/** Terjemahkan satu spesifikasi (diubah langsung). */
export function localizeSpec(spec) {
  if (lang !== 'en' || spec.__localized) return spec;
  spec.__localized = true;
  spec.name = tr(spec.name);
  spec.desc = tr(spec.desc);
  if (spec.props) spec.props = spec.props.map(prop);
  const pins = spec.pins;
  if (typeof pins === 'function') spec.pins = (props, group) => pins(props, group).map(pin);
  else if (pins) spec.pins = pins.map(pin);
  return spec;
}
