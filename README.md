# Vazão — Controle de Produção

App (PWA) para lançar e consultar registros de produção de **DHZs** e **Moinhos**, com cadastros, filtro por período, aderência (Vazão ÷ Set-point) e exportação em CSV/PDF.

Stack: TanStack Start (React 19 + SSR), Tailwind CSS, Postgres no [Neon](https://neon.tech).

## Rodando localmente

Requer Node.js 22+.

```sh
npm install
cp .env.example .env      # e preencha DATABASE_URL com a string do Neon
npm run db:migrate        # cria as tabelas (idempotente)
npm run dev               # http://localhost:8080
```

## Produção

```sh
npm run build
npm start                 # node .output/server/index.mjs (porta 3000; defina PORT para mudar)
```

Defina a variável de ambiente `DATABASE_URL` no servidor/hospedagem.

## Estrutura

- `src/routes/index.tsx` — tela principal (DHZ, Moinhos, Cadastros)
- `src/lib/api.ts` — server functions (todo acesso ao banco passa por aqui)
- `src/lib/db.server.ts` — conexão com o Neon (apenas servidor)
- `db/schema.sql` — esquema do banco; `scripts/migrate.mjs` aplica
- `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` — PWA

## PWA

Em produção o app pode ser instalado no celular/computador ("Adicionar à tela inicial" / ícone de instalar no navegador). Requer HTTPS (ou localhost).
