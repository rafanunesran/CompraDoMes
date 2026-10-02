export const CATEGORIES = [
  "Hortifrúti",
  "Carnes e peixes",
  "Frios e laticínios",
  "Padaria",
  "Mercearia",
  "Bebidas",
  "Congelados",
  "Limpeza",
  "Higiene",
  "Bebê",
  "Pet",
  "Outros",
] as const;

export function categoryOrder(c: string): number {
  const i = (CATEGORIES as readonly string[]).indexOf(c);
  return i === -1 ? CATEGORIES.length : i;
}
