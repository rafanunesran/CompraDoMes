@AGENTS.md

# CompraDoMes

- Interface e textos em português do Brasil.
- Plano de produto e fases: `docs/PLANO.md`.
- Banco: `supabase/migrations/`. Toda tabela tem `household_id` e RLS via `public.is_member()`.
- `normalizeUnitPrice` (`src/lib/units.ts`) precisa ficar igual a `public.normalize_unit_price` no SQL.
- Antes de commitar: `npm run lint && npm run typecheck && npm test && npm run build`.
