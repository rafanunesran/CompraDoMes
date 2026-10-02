# CompraDoMes — Plano de telas e arquitetura

## Contexto
Repositório vazio (branch `claude/blissful-darwin-6d68ic`). Objetivo: PWA mobile-first para a família montar a lista de compras do mês, marcar itens durante a compra informando o mercado, registrar preços (manual ou lendo o QR Code do cupom fiscal NFC-e), unificar produtos equivalentes de marcas diferentes e recomendar onde comprar cada item.

Decisões tomadas: **família compartilhada** (login + "Casa"), **PWA offline-first**, **Next.js (App Router) + Supabase (Postgres, Auth, Realtime, Storage)**, hospedagem Vercel.

---

## Conceito-chave: 3 níveis de produto
Isso resolve o "juntar produtos iguais de marcas diferentes":

1. **Produto genérico** (o que vai na lista): "Arroz branco tipo 1", "Leite integral", "Detergente".
2. **Produto específico / SKU** (marca + tamanho + EAN): "Arroz Camil 5kg — 7896006711155".
3. **Alias de cupom** (texto como aparece na nota de cada mercado): "ARROZ CAMIL T1 5KG" no Mercado X, código interno 12345.

A lista usa o genérico; preços são registrados no SKU; o alias liga o cupom ao SKU automaticamente nas próximas compras. Comparação sempre por **preço unitário normalizado** (R$/kg, R$/L, R$/un) para comparar 5kg com 1kg.

---

## Telas principais (o que você pediu)

### 1. Início / Dashboard
- Lista do mês atual (progresso: X de Y itens), gasto do mês vs mês anterior.
- Atalhos: "Iniciar compra", "Escanear cupom", "Ver recomendação".

### 2. Lista do mês
- Itens genéricos com quantidade, categoria, observação ("marca preferida: Camil" ou "qualquer marca").
- Adicionar por busca com autocomplete (do catálogo da casa), voz ou "repetir lista do mês passado".
- Agrupar por categoria/corredor; filtros "faltam" / "comprados".
- Cada item mostra o melhor preço conhecido e em qual mercado.

### 3. Modo Compra (tela usada dentro do mercado)
- Ao entrar: **selecionar mercado** (sugere o mais próximo via GPS ou o último usado).
- Lista grande, fácil de tocar; ao marcar o item abre um mini-formulário: preço, quantidade, marca/SKU (opcional), ler código de barras do produto pela câmera.
- Adicionar item fora da lista na hora ("compra por impulso").
- Total parcial do carrinho em tempo real + alerta "este item está R$ X mais barato no Mercado Y".
- Funciona offline; sincroniza depois. Outros membros veem em tempo real (ex.: um em cada mercado).
- Finalizar compra → oferece escanear o cupom para conferir/completar preços.

### 4. Escanear cupom fiscal (NFC-e)
- Lê o **QR Code** do cupom → URL da SEFAZ → backend busca e extrai itens (descrição, código, qtd, unidade, valor unitário, total), CNPJ/nome do mercado, data.
- Alternativas: colar chave de acesso de 44 dígitos; foto do cupom com OCR por IA (fallback quando o QR não funciona ou o estado não é suportado).
- Mercado é criado/identificado automaticamente pelo CNPJ.

### 5. Revisão da importação do cupom
- Lista de itens do cupom com o match sugerido: ✅ já conhecido (alias), 🟡 sugestão (confirmar), 🔴 novo (criar ou associar a um genérico).
- Ações rápidas: aceitar todos os confirmados, associar a genérico existente, criar novo.
- Vincula à compra feita no Modo Compra (se houver) e marca itens da lista como comprados; aponta divergências (preço da gôndola ≠ preço cobrado).

### 6. Comparar preços (por produto)
- Para um genérico: tabela por mercado com último preço, preço unitário normalizado, data, menor histórico.
- Gráfico de evolução do preço ao longo do tempo por mercado.
- Detalhamento por marca/SKU.

### 7. Recomendação "Onde comprar"
- Pega a lista atual e calcula:
  - **Tudo em 1 mercado**: total estimado em cada mercado (com nº de itens sem preço conhecido).
  - **Dividir em 2 mercados**: melhor combinação e economia vs 1 mercado.
  - Item a item: onde está mais barato.
- Parâmetros: máximo de mercados a visitar, economia mínima que compensa ir em mais um, ignorar preços mais velhos que N dias.
- Resultado gera "sublistas por mercado" que podem ser abertas no Modo Compra.

### 8. Mercados
- Lista de mercados (nome, CNPJ, endereço, mapa), favoritos, último preço registrado, ranking "mais barato no geral".

### 9. Catálogo de produtos
- Genéricos com seus SKUs e aliases; editar categoria, unidade base, imagem.
- **Tela de mesclagem**: selecionar dois produtos e unificar (ou desfazer); fila de "possíveis duplicados" sugeridos automaticamente.

---

## Telas que você talvez não tenha imaginado

10. **Login / Criar ou entrar numa Casa** — convite por link/código, papéis (admin/membro).
11. **Onboarding** — escolher itens comuns de uma lista pronta para não começar do zero; importar primeiro cupom.
12. **Histórico de compras** — cada compra (data, mercado, total, quem comprou), detalhe com itens, foto/link do cupom.
13. **Relatórios de gastos** — gasto por mês, por categoria, por mercado; inflação pessoal da cesta ("sua cesta ficou 4% mais cara"); itens que mais subiram.
14. **Orçamento** — limite mensal (total e por categoria) com alerta no Modo Compra.
15. **Despensa / Estoque** (opcional fase 2) — o que tem em casa; sugestão automática da próxima lista com base na frequência de compra ("você compra café a cada 20 dias").
16. **Lista recorrente / modelo** — itens fixos todo mês gerados automaticamente.
17. **Alertas de preço** — "avise quando o azeite ficar abaixo de R$ 30/L" ou quando um preço registrado for muito acima do normal.
18. **Fila de pendências** — itens de cupom não associados, produtos sem categoria, possíveis duplicados (uma "caixa de entrada" de dados a revisar).
19. **Leitor de código de barras avulso** — na gôndola, escaneia o EAN e mostra o histórico daquele produto em todos os mercados ("vale a pena levar aqui?").
20. **Configurações** — unidades, categorias/ordem dos corredores por mercado, preço válido por quantos dias, exportar dados (CSV), tema escuro.
21. **Sincronização / offline** — indicador de pendências não enviadas e resolução de conflitos.
22. **Promoções / preço de atacado** — registrar "leve 3 pague 2" ou preço a partir de X unidades, e preço de clube/app do mercado (muito comum e distorce comparações).

---

## Modelo de dados (Supabase / Postgres)
- `households`, `household_members(user_id, role)`
- `stores(cnpj, name, address, lat, lng)`
- `categories`
- `products` (genérico: name, category_id, base_unit ∈ kg/L/un)
- `skus(product_id, brand, ean, package_qty, package_unit)`
- `receipt_aliases(store_id, store_code, raw_description, sku_id)`
- `shopping_lists(month)`, `list_items(product_id, qty, preferred_sku_id, status)`
- `purchases(store_id, date, total, receipt_key, source)`, `purchase_items(sku_id|product_id, qty, unit_price, total, raw_description)`
- `price_observations(sku_id, store_id, price, unit_price_normalized, observed_at, source ∈ manual|nfce|ocr, promo_type)` — base da comparação
- `merge_suggestions`, `budgets`, `price_alerts`
- RLS por `household_id` em todas as tabelas.

## Peças técnicas
- **Leitura NFC-e**: QR via câmera (`@zxing/browser` ou `BarcodeDetector`) → API route do Next.js baixa a página da SEFAZ do estado e faz o parse (Cheerio). Começar por **SP** (ou o estado do usuário) e adicionar parsers por UF. Cache por chave de acesso para não duplicar.
- **OCR fallback**: foto → Claude (visão) retorna JSON de itens.
- **Matching automático**: (1) alias exato loja+código → (2) EAN → (3) similaridade de texto (`pg_trgm`) + normalização de abreviações (CX, PCT, UN, KG) e extração de peso/volume por regex → (4) sugestão por IA para casos ambíguos. Abaixo do limiar de confiança vai para a fila de revisão.
- **Recomendação**: para cada item, preço mais recente por mercado (ajustado ao preço unitário); totais por mercado; combinação de 2 mercados por força bruta (poucos mercados → barato).
- **PWA**: `next-pwa`/Serwist, IndexedDB (Dexie) para fila offline, Supabase Realtime para lista compartilhada.
- UI: Tailwind + shadcn/ui, gráficos com Recharts.

## Fases de entrega
1. **MVP**: auth + casa, lista do mês, modo compra com mercado e preço manual, histórico, comparação simples por produto.
2. **Cupom**: QR NFC-e (1 estado), revisão de importação, aliases, cadastro automático de mercados e SKUs.
3. **Inteligência**: unificação de produtos (genérico/SKU, mesclagem, fila de duplicados), preço normalizado, recomendação "onde comprar".
4. **Extras**: offline completo, relatórios, orçamento, alertas, despensa, OCR por foto, outros estados.

## Verificação
- Testes unitários (Vitest) para parser de NFC-e com HTMLs salvos de cupons reais, normalização de unidades e algoritmo de recomendação.
- E2E (Playwright, Chromium já instalado) do fluxo: criar lista → modo compra → marcar itens com preço → finalizar → ver comparação.
- Testar PWA offline no DevTools e sincronização com 2 sessões de usuários da mesma casa.

## Perguntas em aberto (para a fase 2)
- Em qual estado ficam os mercados (define o primeiro parser de NFC-e)?
