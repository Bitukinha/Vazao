import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/nutrimilho-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle de Produção — Nutrimilho" },
      { name: "description", content: "Lance e consulte os registros de produção Nutrimilho: DHZs e Moinhos." },
      { property: "og:title", content: "Controle de Produção — Nutrimilho" },
      { property: "og:description", content: "Lance e consulte os registros de produção Nutrimilho: DHZs e Moinhos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const input =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
const btn =
  "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50";

type Tipo = "dhz" | "moinho" | "responsavel";
type Cad = { id: string; tipo: Tipo; nome: string };

type FieldDef = { key: string; label: string; kind: "num" | "text" | "select"; source?: Tipo; required?: boolean };
type TabDef = { table: "registros_producao" | "registros_moinho"; title: string; fields: FieldDef[]; file: string };

const DHZ_TAB: TabDef = {
  table: "registros_producao",
  title: "DHZ",
  file: "controle_dhz",
  fields: [
    { key: "dhz_nome", label: "DHZ", kind: "select", source: "dhz" },
    { key: "dureza_milho", label: "Dureza Milho", kind: "num" },
    { key: "agua_adicionada", label: "Água Adicionada", kind: "num" },
    { key: "amp", label: "Amp.", kind: "num" },
    { key: "vazao_canjica", label: "Vazão Canjica (kg/h)", kind: "num" },
    { key: "vazao_germen", label: "Vazão Gérmen (kg/h)", kind: "num" },
    { key: "vazao_milho", label: "Vazão Milho (kg/h)", kind: "num" },
    { key: "pct_germen", label: "% Gérmen gerado", kind: "num" },
    { key: "prod_final", label: "Prod. Final", kind: "text" },
    { key: "nome_resp", label: "Nome Resp.", kind: "select", source: "responsavel", required: true },
  ],
};

const MOINHO_TAB: TabDef = {
  table: "registros_moinho",
  title: "Moinhos",
  file: "controle_moinhos",
  fields: [
    { key: "moinho", label: "Moinho", kind: "select", source: "moinho", required: true },
    { key: "set_point", label: "Set-point", kind: "num" },
    { key: "vazao", label: "Vazão", kind: "num" },
    { key: "produto", label: "Produto", kind: "text" },
    { key: "nome_resp", label: "Resp.", kind: "select", source: "responsavel", required: true },
  ],
};

function Index() {
  const [tab, setTab] = useState<"dhz" | "moinho" | "cad">("dhz");
  const [cads, setCads] = useState<Cad[]>([]);
  async function loadCads() {
    const { data } = await supabase.from("cadastros").select("*").order("nome");
    setCads((data ?? []) as Cad[]);
  }
  useEffect(() => {
    loadCads();
  }, []);

  const tabs = [
    ["dhz", "DHZ"],
    ["moinho", "Moinhos"],
    ["cad", "Cadastros"],
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-4 border-secondary bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <img src={logo.url} alt="Nutrimilho" className="h-10" />
          <nav className="flex gap-1">
            {tabs.map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-primary hover:bg-muted"}`}
              >
                {l}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {tab === "dhz" && <RecordTab key="dhz" def={DHZ_TAB} cads={cads} />}
        {tab === "moinho" && <RecordTab key="moinho" def={MOINHO_TAB} cads={cads} />}
        {tab === "cad" && <Cadastros cads={cads} reload={loadCads} />}
      </main>
    </div>
  );
}

const nowDate = () => new Date().toLocaleDateString("en-CA");
const nowTime = () => new Date().toTimeString().slice(0, 5);
type Form = Record<string, string> & { data: string; hora: string; nome_resp?: string };
type Row = Record<string, unknown> & { id: string; data: string; hora: string };

function RecordTab({ def, cads }: { def: TabDef; cads: Cad[] }) {
  const empty = (): Form => ({ data: nowDate(), hora: nowTime() });
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    let q = supabase.from(def.table).select("*").order("data", { ascending: false }).order("hora", { ascending: false }).limit(500);
    if (from) q = q.gte("data", from);
    if (to) q = q.lte("data", to);
    const { data, error } = await q;
    if (error) setErr(error.message);
    else setRows((data ?? []) as unknown as Row[]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const cell = (r: Row, f: FieldDef) => {
    const v = r[f.key] ?? (f.key === "dhz_nome" ? r["dhz"] : null);
    return v == null || v === "" ? "—" : String(v);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const payload: Record<string, unknown> = { data: form.data, hora: form.hora };
    for (const f of def.fields) {
      const v = form[f.key] ?? "";
      payload[f.key] = f.kind === "num" ? (v ? Number(v.replace(",", ".")) : null) : v || null;
    }
    const { error } = editId
      ? await supabase.from(def.table).update(payload as never).eq("id", editId)
      : await supabase.from(def.table).insert(payload as never);
    setBusy(false);
    if (error) return setErr(error.message);
    setForm({ ...empty(), nome_resp: form.nome_resp ?? "" });
    setEditId(null);
    load();
  }

  function edit(r: Row) {
    const f: Form = { data: r.data, hora: r.hora.slice(0, 5) };
    for (const d of def.fields) f[d.key] = cell(r, d) === "—" ? "" : cell(r, d);
    setForm(f);
    setEditId(r.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!confirm("Excluir este registro?")) return;
    await supabase.from(def.table).delete().eq("id", id);
    load();
  }

  function exportCsv() {
    const head = ["Data", "Hora", ...def.fields.map((f) => f.label)];
    const lines = rows.map((r) =>
      [r.data.split("-").reverse().join("/"), r.hora.slice(0, 5), ...def.fields.map((f) => { const c = cell(r, f); return c === "—" ? "" : f.kind === "num" ? c.replace(".", ",") : c; })]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["\ufeff" + [head.join(";"), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${def.file}_${nowDate()}.csv`;
    a.click();
  }

  function exportPdf() {
    const head = ["Data", "Hora", ...def.fields.map((f) => f.label)];
    const body = rows
      .map(
        (r) =>
          `<tr>${[r.data.split("-").reverse().join("/"), r.hora.slice(0, 5), ...def.fields.map((f) => { const c = cell(r, f); return c === "—" ? "" : c; })]
            .map((v) => `<td>${String(v).replace(/</g, "&lt;")}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Registros ${def.title}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#222}
      h1{font-size:18px;margin:0 0 4px}p{font-size:12px;color:#666;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
      th{background:#1f5c2e;color:#fff}
      tr:nth-child(even){background:#f4f4f4}
      @media print{body{padding:0}}
    </style></head><body>
      <h1>Nutrimilho — Registros ${def.title}</h1>
      <p>Gerado em ${new Date().toLocaleString("pt-BR")}${from || to ? ` — Período: ${from ? from.split("-").reverse().join("/") : "…"} a ${to ? to.split("-").reverse().join("/") : "…"}` : ""} — ${rows.length} registro(s)</p>
      <table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
    w.document.close();
  }

  // Aderência: Vazão ÷ Set-point (apenas Moinhos)
  const ader = def.table === "registros_moinho"
    ? rows
        .map((r) => {
          const sp = Number(r["set_point"]);
          const vz = Number(r["vazao"]);
          return sp > 0 && !isNaN(vz) ? (vz / sp) * 100 : null;
        })
        .filter((v): v is number => v != null)
    : [];
  const aderMedia = ader.length ? ader.reduce((a, b) => a + b, 0) / ader.length : null;
  const aderColor = aderMedia == null ? "" : aderMedia >= 95 ? "text-green-600" : aderMedia >= 80 ? "text-yellow-600" : "text-destructive";

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-bold text-primary">
          {editId ? `Editar registro — ${def.title}` : `Novo lançamento — ${def.title}`}
        </h1>
        <form onSubmit={save} className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <Field label="Data"><input className={input} type="date" required value={form.data} onChange={set("data")} /></Field>
          <Field label="Hora"><input className={input} type="time" required value={form.hora} onChange={set("hora")} /></Field>
          {def.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.kind === "select" ? (
                <select className={input} required={f.required} value={form[f.key] ?? ""} onChange={set(f.key)}>
                  <option value="">Selecione…</option>
                  {cads.filter((c) => c.tipo === f.source).map((c) => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                  {form[f.key] && !cads.some((c) => c.tipo === f.source && c.nome === form[f.key]) && (
                    <option value={form[f.key]}>{form[f.key]}</option>
                  )}
                </select>
              ) : (
                <input className={input} inputMode={f.kind === "num" ? "decimal" : undefined} required={f.required} value={form[f.key] ?? ""} onChange={set(f.key)} />
              )}
            </Field>
          ))}
          <div className="col-span-2 flex items-end gap-2">
            <button className={btn} disabled={busy}>{editId ? "Salvar alterações" : "Lançar"}</button>
            {editId && (
              <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => { setEditId(null); setForm(empty()); }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      </section>

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b p-4">
          <h2 className="text-lg font-bold text-primary">Registros {def.title} ({rows.length})</h2>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="De"><input className={input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Até"><input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            {aderMedia != null && (
              <div className="rounded-md border bg-muted/50 px-4 py-1 text-center">
                <span className="block text-xs font-medium text-muted-foreground">Aderência (Vazão ÷ Set-point)</span>
                <span className={`text-lg font-bold ${aderColor}`}>{aderMedia.toFixed(1).replace(".", ",")}%</span>
              </div>
            )}
            <button className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground" onClick={exportCsv}>
              Exportar Excel (CSV)
            </button>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={exportPdf}>
              Exportar PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                {["Data", "Hora", ...def.fields.map((f) => f.label), ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b odd:bg-muted/50">
                  <td className="whitespace-nowrap px-3 py-2">{r.data.split("-").reverse().join("/")}</td>
                  <td className="px-3 py-2">{r.hora.slice(0, 5)}</td>
                  {def.fields.map((f) => (
                    <td key={f.key} className="px-3 py-2">{cell(r, f)}</td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2">
                    <button className="mr-3 text-primary underline" onClick={() => edit(r)}>Editar</button>
                    <button className="text-destructive underline" onClick={() => remove(r.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={def.fields.length + 3} className="px-3 py-8 text-center text-muted-foreground">Nenhum registro ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Cadastros({ cads, reload }: { cads: Cad[]; reload: () => void }) {
  const groups: [Tipo, string][] = [
    ["dhz", "DHZs"],
    ["moinho", "Moinhos"],
    ["responsavel", "Responsáveis"],
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {groups.map(([t, l]) => (
        <CadList key={t} tipo={t} title={l} items={cads.filter((c) => c.tipo === t)} reload={reload} />
      ))}
    </div>
  );
}

function CadList({ tipo, title, items, reload }: { tipo: Tipo; title: string; items: Cad[]; reload: () => void }) {
  const [nome, setNome] = useState("");
  const [err, setErr] = useState("");
  async function add(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const { error } = await supabase.from("cadastros").insert({ tipo, nome: nome.trim() });
    if (error) return setErr(error.code === "23505" ? "Já cadastrado." : error.message);
    setNome("");
    reload();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este cadastro?")) return;
    await supabase.from("cadastros").delete().eq("id", id);
    reload();
  }
  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-primary">{title}</h2>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input className={input} required placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <button className={btn}>Adicionar</button>
      </form>
      {err && <p className="mb-2 text-sm text-destructive">{err}</p>}
      <ul className="divide-y">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            {c.nome}
            <button className="text-destructive underline" onClick={() => remove(c.id)}>Excluir</button>
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nenhum cadastro.</li>}
      </ul>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
