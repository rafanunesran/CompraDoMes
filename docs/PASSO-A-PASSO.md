# Passo a passo: colocar o CompraDoMes no ar

Tudo é feito pelo navegador, sem instalar nada. Você vai usar três serviços gratuitos:

- **GitHub**: onde o código já está.
- **Supabase**: banco de dados e login.
- **Vercel**: hospeda o site e gera o link.

Tempo estimado: 20 a 30 minutos.

---

## 1. GitHub: deixar `main` como branch padrão

1. Abra o repositório `rafanunesran/CompraDoMes` no GitHub.
2. Vá em **Settings → General → Default branch**.
3. Clique no ícone de troca (⇄), escolha **`main`** e confirme em **Update**.

Assim a Vercel publica sempre o código do `main`.

---

## 2. Supabase: criar o banco

### 2.1 Criar o projeto

1. Acesse https://supabase.com e entre com sua conta do GitHub.
2. Clique em **New project**.
3. Preencha:
   - **Name**: `compradomes`
   - **Database Password**: clique em *Generate* e **guarde essa senha** num lugar seguro.
   - **Region**: **South America (São Paulo)**.
4. Clique em **Create new project** e espere uns 2 minutos até o projeto ficar pronto.

### 2.2 Criar as tabelas

1. No menu lateral, abra o **SQL Editor** e clique em **New query**.
2. No GitHub, abra o arquivo [`supabase/migrations/20261002000000_init.sql`](../supabase/migrations/20261002000000_init.sql), clique em **Raw** e copie **todo** o conteúdo.
3. **Antes de colar**, confira o seletor ao lado dos botões **Save / Run**: ele precisa estar em **Primary database** (ou `postgres`), e **não** em **Logs**. Se aparecer "Logs", troque no seletor ou abra uma nova query em **+ → New query**.
4. Cole no editor do Supabase e clique em **Run** (ou Ctrl+Enter).
5. Deve aparecer **"Success. No rows returned"**.
6. Para conferir, abra **Table Editor**. Devem aparecer as tabelas `households`, `household_members`, `stores`, `products`, `skus`, `shopping_lists`, `list_items`, `purchases`, `purchase_items` e `price_observations`.

> Rode esse SQL **uma vez só**. Se rodar de novo, vai aparecer o erro "already exists". Isso só quer dizer que as tabelas já foram criadas.

### 2.3 Login por e-mail (opcional, recomendado para começar)

Por padrão o Supabase manda um e-mail de confirmação para cada conta nova. O envio gratuito tem limite de poucos e-mails por hora. Para começar sem esse limite:

1. Vá em **Authentication → Sign In / Providers → Email**.
2. Desligue **Confirm email** e salve.

Dá para religar depois, quando o app já estiver em uso.

### 2.4 Copiar as chaves

1. Vá em **Project Settings → API Keys** (em alguns painéis o nome é **API** ou **Data API**).
2. Copie e deixe guardados:
   - **Project URL**: algo como `https://abcdefgh.supabase.co` (fica em *Data API* ou no topo da página de API).
   - **Chave pública**: a **`anon` `public`** ou a **publishable** (`sb_publishable_...`). Qualquer uma das duas funciona.

> **Nunca** use a chave `service_role` ou a *secret*: elas dão acesso total ao banco.

---

## 3. Vercel: publicar o site

1. Acesse https://vercel.com e entre com o **GitHub**.
2. Clique em **Add New… → Project**.
3. Na lista de repositórios, ache **CompraDoMes** e clique em **Import**.
   - Se ele não aparecer, clique em *Adjust GitHub App Permissions* e dê acesso ao repositório.
4. A Vercel detecta **Next.js** sozinha. Não mexa em *Build Command* nem em *Output Directory*.
5. Abra **Environment Variables** e adicione as duas variáveis:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | a Project URL do passo 2.4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave pública do passo 2.4 |

6. Clique em **Deploy** e espere de 1 a 2 minutos.
7. Quando terminar, copie o link do site, algo como `https://compradomes.vercel.app`. Ele aparece em **Domains** no painel do projeto.

---

## 4. Supabase: autorizar o endereço do site

Esse passo faz o login e os links de confirmação voltarem para o seu site.

1. No Supabase, vá em **Authentication → URL Configuration**.
2. Em **Site URL**, coloque o link da Vercel, por exemplo `https://compradomes.vercel.app`.
3. Em **Redirect URLs**, clique em **Add URL** e adicione o mesmo link seguido de `/auth/callback`, por exemplo `https://compradomes.vercel.app/auth/callback`.
4. Salve.

---

## 5. Primeiro uso

1. Abra o link no celular.
2. Toque em **Criar conta** e informe e-mail e senha (mínimo de 6 caracteres).
3. Crie a sua **casa**, por exemplo "Casa da família".
4. Em **Mais → Casa e família**, toque em **Convidar pessoa da família** e mande o link pelo WhatsApp. Quem receber cria a conta e já entra na mesma casa.
5. Instale como app:
   - **Android (Chrome)**: menu ⋮ → **Instalar app** ou **Adicionar à tela inicial**.
   - **iPhone (Safari)**: botão Compartilhar → **Adicionar à Tela de Início**.

## 6. Teste rápido

1. **Lista**: adicione "Arroz" (comparar por kg), "Leite" (por litro) e "Detergente" (por unidade).
2. **Comprar**: cadastre um mercado, toque em cada item e informe o preço. No arroz, preencha a embalagem, por exemplo `5 kg`.
3. **Finalizar compra**.
4. Abra **Preços** e veja os valores. Faça outra compra em um segundo mercado e veja a comparação e o aviso de "mais caro que no…".

---

## 7. Problemas comuns

| Sintoma | Causa provável e solução |
| --- | --- |
| "Invalid API key" ou nada carrega | Variável errada na Vercel. Corrija em **Settings → Environment Variables** e depois faça **Deployments → ⋯ → Redeploy**. Mudar uma variável sem fazer Redeploy não tem efeito. |
| Fica voltando para a tela de login | Confira as duas variáveis e a **Site URL** do Supabase (passo 4). Tente também numa aba anônima. |
| E-mail de confirmação não chega | Limite do envio gratuito do Supabase. Desligue **Confirm email** (passo 2.3) e crie a conta de novo. |
| Link do e-mail abre `localhost` | A **Site URL** do Supabase ainda está como `http://localhost:3000`. Troque pelo link da Vercel. |
| "Failed to get project's logs" ou aviso sobre *ClickHouse* no SQL Editor | A query foi rodada na fonte **Logs**, e não no banco. Troque o seletor ao lado de **Save / Run** para **Primary database** e rode de novo. |
| Erro "relation ... does not exist" | O SQL do passo 2.2 não foi rodado, ou foi rodado em outro projeto do Supabase. |
| "código de convite inválido" | Confira as 6 letras e números do código, em **Mais → Casa e família**. |
| A lista não atualiza em tempo real no outro celular | Puxe a tela para recarregar. Confira em **Database → Publications → supabase_realtime** se `list_items` e `purchase_items` estão marcadas. |

---

## 8. Atualizações

- Cada novo commit no `main` gera um deploy **automático** na Vercel. Não precisa fazer nada.
- Quando uma fase nova trouxer um arquivo novo em `supabase/migrations/`, rode **só esse arquivo novo** no SQL Editor, como no passo 2.2.
- **Plano gratuito:** um projeto do Supabase sem uso por 7 dias é pausado. Para reativar, entre no painel e clique em **Restore**.
