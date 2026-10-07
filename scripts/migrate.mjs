// Aplica db/schema.sql no banco apontado por DATABASE_URL.
// Uso: npm run db:migrate
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL não definida (.env).");
  process.exit(1);
}
const url = new URL(raw);
url.searchParams.delete("channel_binding");

const sql = postgres(url.toString(), { ssl: "require", max: 1, prepare: false });
try {
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await sql.unsafe(schema);
  const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
  console.log("Schema aplicado. Tabelas:", tables.map((t) => t.table_name).join(", "));
} finally {
  await sql.end();
}
