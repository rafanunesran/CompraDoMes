# CompraDoMes

PWA para a família montar a **lista de compras do mês**, registrar os preços na hora da compra em cada mercado e descobrir **onde cada item sai mais barato**.

O plano completo de telas e fases está em [`docs/PLANO.md`](docs/PLANO.md).

## O que já funciona (fase 1)

- **Login** (e-mail e senha) e **Casa compartilhada**: crie uma casa e convide a família com um código.
- **Lista do mês**: adicionar itens com autocomplete, quantidade, agrupamento por categoria, copiar a lista do mês passado e atualização em tempo real entre os celulares.
- **Modo Compra**: escolher o mercado, tocar no item e informar preço, quantidade, embalagem e marca. Mostra o total do carrinho e avisa quando o item está mais barato em outro mercado.
- **Preços**: catálogo com o melhor preço de cada produto, ranking por mercado (por kg, litro ou unidade) e histórico. Também dá para anotar um preço visto na prateleira.
- **Estimativa "onde comprar"**: quanto custaria o que falta da lista em cada mercado, comparado com comprar cada item no mais barato.
- **Histórico** de compras por mês e cadastro de **mercados**.

Próximas fases: leitura do cupom fiscal (QR Code da NFC-e), junção de produtos de marcas diferentes, recomendação completa, modo offline e relatórios.

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- Supabase: Postgres, Auth, Realtime e RLS por casa
- Vitest para os testes

## Configuração

> **Guia detalhado para publicar sem instalar nada:** [`docs/PASSO-A-PASSO.md`](docs/PASSO-A-PASSO.md) (Supabase + Vercel).

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o conteúdo de `supabase/migrations/20261002000000_init.sql` (ou use `supabase db push` com a CLI).
3. Em **Authentication → URL Configuration**, coloque a URL do site em *Site URL* e adicione `https://SEU-SITE/auth/callback` em *Redirect URLs* (`http://localhost:3000/auth/callback` para desenvolvimento).
   - Para testar mais rápido, você pode desativar **Confirm email** em *Authentication → Providers → Email*.
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave pública do projeto.
5. Rode:

```bash
npm install
npm run dev
```

Abra http://localhost:3000. No celular, use "Adicionar à tela inicial" para instalar como app.

### Deploy na Vercel

Importe o repositório na Vercel, defina as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` e adicione a URL final nas *Redirect URLs* do Supabase.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | checagem de tipos |
| `npm test` | testes (Vitest) |

## Estrutura

```
src/
  app/
    login/              entrar / criar conta
    auth/callback/      confirmação de e-mail
    (app)/              telas autenticadas (com a barra de navegação)
      page.tsx          início
      lista/            lista do mês
      compra/           escolher mercado e Modo Compra (compra/[id])
      produtos/         preços e comparação (produtos/[id])
      historico/        compras anteriores
      mercados/         cadastro de mercados
      casa/             casa compartilhada e convites
      mais/             menu
  components/           UI, contexto da casa, formulários
  lib/                  acesso a dados, comparação de preços, unidades, formatação
  proxy.ts              renova a sessão e protege as rotas
supabase/migrations/    esquema do banco (tabelas, RLS, triggers, views)
tests/                  testes unitários
```

### Modelo de preços

- `products` é o **produto genérico** que vai na lista ("Arroz tipo 1"), com a unidade de comparação (`un`, `kg` ou `l`).
- `skus` é o produto de **marca/embalagem** ("Camil 5kg").
- Cada item comprado (`purchase_items`) gera automaticamente uma `price_observations` (trigger), com o **preço normalizado** por kg, litro ou unidade. Assim dá para comparar pacotes de tamanhos diferentes.
- A view `latest_prices` traz o último preço de cada produto em cada mercado.
