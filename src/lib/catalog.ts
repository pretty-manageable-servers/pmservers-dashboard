/** Use the picked id if the catalog has it. If not, use the first id in the catalog. */
export const chooseId = (picked: string | null, items: { id: string }[] | undefined) =>
  items?.find((i) => i.id === picked)?.id ?? items?.[0]?.id ?? '';
