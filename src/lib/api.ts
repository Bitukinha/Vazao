import { createServerFn } from "@tanstack/react-start";

// Tabelas e colunas permitidas — nada fora daqui chega ao SQL.
export const TABLES = {
  registros_producao: {
    num: ["dureza_milho", "agua_adicionada", "amp", "vazao_canjica", "vazao_germen", "vazao_milho", "pct_germen"],
    text: ["dhz_nome", "prod_final", "nome_resp"],
  },
  registros_moinho: {
    num: ["set_point", "vazao"],
    text: ["moinho", "produto", "nome_resp"],
  },
} as const;

export type Tabela = keyof typeof TABLES;
export type Tipo = "dhz" | "moinho" | "responsavel";
export type Cad = { id: string; tipo: Tipo; nome: string };
export type Row = Record<string, string | number | null> & { id: string; data: string; hora: string };

const TIPOS: Tipo[] = ["dhz", "moinho", "responsavel"];

function assertTabela(t: unknown): Tabela {
  if (typeof t !== "string" || !(t in TABLES)) throw new Error("Tabela inválida");
  return t as Tabela;
}

function str(v: unknown, campo: string, max = 200): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`Campo obrigatório: ${campo}`);
  return v.trim().slice(0, max);
}

function cols(t: Tabela) {
  return [...TABLES[t].num, ...TABLES[t].text] as string[];
}

// Monta o registro só com colunas permitidas e tipos corretos.
function payload(t: Tabela, input: Record<string, unknown>) {
  const out: Record<string, string | number | null> = {
    data: str(input["data"], "data", 10),
    hora: str(input["hora"], "hora", 8),
  };
  for (const c of TABLES[t].num) {
    const v = input[c];
    const n = v === null || v === undefined || v === "" ? null : Number(v);
    if (n !== null && !Number.isFinite(n)) throw new Error(`Número inválido: ${c}`);
    out[c] = n;
  }
  for (const c of TABLES[t].text) {
    const v = input[c];
    out[c] = typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null;
  }
  return out;
}

const db = async () => (await import("./db.server")).getSql();

// ---------- Cadastros ----------

export const listCadastros = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  return (await sql`select id::text, tipo, nome from cadastros order by nome`) as unknown as Cad[];
});

export const addCadastro = createServerFn({ method: "POST" })
  .inputValidator((d: { tipo: Tipo; nome: string }) => {
    if (!TIPOS.includes(d.tipo)) throw new Error("Tipo inválido");
    return { tipo: d.tipo, nome: str(d.nome, "nome") };
  })
  .handler(async ({ data }) => {
    const sql = await db();
    try {
      await sql`insert into cadastros (tipo, nome) values (${data.tipo}, ${data.nome})`;
      return { ok: true as const };
    } catch (e) {
      if ((e as { code?: string }).code === "23505") return { ok: false as const, error: "Já cadastrado." };
      throw e;
    }
  });

export const removeCadastro = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => ({ id: str(d.id, "id", 36) }))
  .handler(async ({ data }) => {
    const sql = await db();
    await sql`delete from cadastros where id = ${data.id}`;
  });

// ---------- Registros ----------

export const listRegistros = createServerFn({ method: "GET" })
  .inputValidator((d: { table: Tabela; from?: string; to?: string }) => ({
    table: assertTabela(d.table),
    from: d.from || null,
    to: d.to || null,
  }))
  .handler(async ({ data }) => {
    const sql = await db();
    const extra = data.table === "registros_producao" ? ["dhz"] : [];
    const select = sql.unsafe(
      ["id::text", "data::text as data", "hora::text as hora", ...cols(data.table), ...extra]
        .map((c) => (c.includes("::") ? c : `"${c}"`))
        .join(", "),
    );
    const rows = await sql`
      select ${select} from ${sql(data.table)}
      where (${data.from}::date is null or data >= ${data.from}::date)
        and (${data.to}::date is null or data <= ${data.to}::date)
      order by data desc, hora desc
      limit 500`;
    return rows as unknown as Row[];
  });

export const saveRegistro = createServerFn({ method: "POST" })
  .inputValidator((d: { table: Tabela; id?: string | null; values: Record<string, unknown> }) => {
    const table = assertTabela(d.table);
    return { table, id: d.id || null, values: payload(table, d.values ?? {}) };
  })
  .handler(async ({ data }) => {
    const sql = await db();
    const keys = Object.keys(data.values);
    if (data.id) {
      await sql`update ${sql(data.table)} set ${sql(data.values, keys)} where id = ${data.id}`;
    } else {
      await sql`insert into ${sql(data.table)} ${sql(data.values, keys)}`;
    }
  });

export const removeRegistro = createServerFn({ method: "POST" })
  .inputValidator((d: { table: Tabela; id: string }) => ({
    table: assertTabela(d.table),
    id: str(d.id, "id", 36),
  }))
  .handler(async ({ data }) => {
    const sql = await db();
    await sql`delete from ${sql(data.table)} where id = ${data.id}`;
  });
