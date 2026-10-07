import postgres from "postgres";

// Conexão com o Neon (Postgres). Só roda no servidor.
let _sql: postgres.Sql | undefined;

export function getSql() {
  if (_sql) return _sql;
  const raw = process.env["DATABASE_URL"];
  if (!raw) throw new Error("DATABASE_URL não definida. Configure o arquivo .env.");
  // postgres.js não entende channel_binding e repassaria como parâmetro ao servidor.
  const url = new URL(raw);
  url.searchParams.delete("channel_binding");
  _sql = postgres(url.toString(), {
    ssl: "require",
    max: 5,
    prepare: false, // compatível com o pooler do Neon
  });
  return _sql;
}
