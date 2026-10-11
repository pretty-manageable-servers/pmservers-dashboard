/** Use the picked id if the catalog has it. If not, use the first id in the catalog. */
export const chooseId = (picked: string | null, items: { id: string }[] | undefined) =>
  items?.find((i) => i.id === picked)?.id ?? items?.[0]?.id ?? '';

const MODEL_BADGES = new Map<string, { className: string; label: string }>([
  ['llm', { className: 'badge llm', label: 'LLM' }],
  ['embedding', { className: 'badge emb', label: 'Embedding' }],
  ['decision', { className: 'badge dec', label: 'Decision' }],
  ['stt', { className: 'badge stt', label: 'STT' }],
  ['tts', { className: 'badge tts', label: 'TTS' }],
]);

/** Badge for a model type. An unknown type gets a plain badge with the raw type. */
export const modelBadge = (type: string) =>
  MODEL_BADGES.get(type) ?? { className: 'badge', label: type };

/** Model ids that a new key starts with. LLM and TTS models are not preselected. */
export const defaultModelIds = (models: { id: string; type: string }[]) =>
  models.filter((m) => m.type !== 'llm' && m.type !== 'tts').map((m) => m.id);

/** Up to 3 significant digits, no trailing zeros: 0.156667 gives "0.157", 15 gives "15". */
const priceText = (n: number) => String(Number(n.toPrecision(3)));

/** Price text for a model, or null when the model has no price of its kind. */
export const modelPrice = (m: {
  type: string;
  price_in_per_m?: number | null;
  price_out_per_m?: number | null;
  price_per_minute?: number | null;
  price_per_m_chars?: number | null;
}) => {
  if (m.type === 'stt' && m.price_per_minute != null)
    return `$${priceText(m.price_per_minute)} / min`;
  if (m.type === 'tts' && m.price_per_m_chars != null)
    return `$${priceText(m.price_per_m_chars)} / 1M chars`;
  if (m.price_in_per_m == null) return null;
  const input = `$${priceText(m.price_in_per_m)}`;
  // Embedding and decision models have no output price, so show only the input price.
  if (m.type !== 'llm' && (m.price_out_per_m ?? 0) === 0) return `${input} / 1M tokens`;
  if (m.price_out_per_m == null) return null;
  return `${input} in · $${priceText(m.price_out_per_m)} out / 1M tokens`;
};
