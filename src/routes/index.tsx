import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  addCadastro,
  listCadastros,
  listRegistros,
  removeCadastro,
  removeRegistro,
  saveRegistro,
  type Cad,
  type Row,
  type Tabela,
  type Tipo,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vazão — Controle de Produção" },
      { name: "description", content: "Lance e consulte os registros de produção: DHZs e Moinhos." },
    ],
  }),
  component: Index,
});

// text-base no celular evita o zoom automático do iOS ao focar o campo.
const input =
  "w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring sm:text-sm";
const btn =
  "rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:py-2";

type FieldDef = { key: string; label: string; kind: "num" | "text" | "select"; source?: Tipo; required?: boolean };
type TabDef = { table: Tabela; title: string; fields: FieldDef[]; file: string };

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

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Index() {
  const [tab, setTab] = useState<"dhz" | "moinho" | "cad">("dhz");
  const [cads, setCads] = useState<Cad[]>([]);
  async function loadCads() {
    try {
      setCads(await listCadastros());
    } catch (e) {
      console.error(e);
    }
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
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b-4 border-secondary bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/logo-vazao.png" alt="Vazão" className="h-11 w-11 rounded-lg sm:h-12 sm:w-12" />
            <div className="leading-tight">
              <span className="block text-lg font-bold text-primary">Vazão</span>
              <span className="block text-xs text-muted-foreground">Controle de Produção</span>
            </div>
          </div>
          <nav className="grid grid-cols-3 gap-1 sm:flex">
            {tabs.map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-md px-3 py-2 text-sm font-semibold sm:px-4 ${tab === k ? "bg-primary text-primary-foreground" : "text-primary hover:bg-muted"}`}
              >
                {l}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:space-y-8 sm:px-6 sm:py-8">
        {tab === "dhz" && <RecordTab key="dhz" def={DHZ_TAB} cads={cads} />}
        {tab === "moinho" && <RecordTab key="moinho" def={MOINHO_TAB} cads={cads} />}
        {tab === "cad" && <Cadastros cads={cads} reload={loadCads} />}
      </main>
    </div>
  );
}

const nowDate = () => new Date().toLocaleDateString("en-CA");
const nowTime = () => new Date().toTimeString().slice(0, 5);
const brDate = (d: string) => d.split("-").reverse().join("/");
type Form = Record<string, string> & { data: string; hora: string; nome_resp?: string };

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
    try {
      setRows(await listRegistros({ data: { table: def.table, from, to } }));
    } catch (e) {
      setErr(errMsg(e));
    }
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
    const values: Record<string, unknown> = { data: form.data, hora: form.hora };
    for (const f of def.fields) {
      const v = form[f.key] ?? "";
      values[f.key] = f.kind === "num" ? (v ? Number(v.replace(",", ".")) : null) : v || null;
    }
    try {
      await saveRegistro({ data: { table: def.table, id: editId, values } });
    } catch (e) {
      setBusy(false);
      return setErr(errMsg(e));
    }
    setBusy(false);
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
    try {
      await removeRegistro({ data: { table: def.table, id } });
    } catch (e) {
      setErr(errMsg(e));
    }
    load();
  }

  function exportCsv() {
    const head = ["Data", "Hora", ...def.fields.map((f) => f.label)];
    const lines = rows.map((r) =>
      [
        brDate(r.data),
        r.hora.slice(0, 5),
        ...def.fields.map((f) => {
          const c = cell(r, f);
          return c === "—" ? "" : f.kind === "num" ? c.replace(".", ",") : c;
        }),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\n")], { type: "text/csv" });
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
          `<tr>${[
            brDate(r.data),
            r.hora.slice(0, 5),
            ...def.fields.map((f) => {
              const c = cell(r, f);
              return c === "—" ? "" : c;
            }),
          ]
            .map((v) => `<td>${String(v).replace(/</g, "&lt;")}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Registros ${def.title}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#222}
      h1{font-size:18px;margin:0 0 4px}p{font-size:12px;color:#666;margin:0 0 16px}
      .wrap{overflow-x:auto}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
      th{background:#1f5c2e;color:#fff}
      tr:nth-child(even){background:#f4f4f4}
      @media print{body{padding:0}}
    </style></head><body>
      <h1>Vazão — Registros ${def.title}</h1>
      <p>Gerado em ${new Date().toLocaleString("pt-BR")}${from || to ? ` — Período: ${from ? brDate(from) : "…"} a ${to ? brDate(to) : "…"}` : ""} — ${rows.length} registro(s)</p>
      <div class="wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
    w.document.close();
  }

  // Aderência: Vazão ÷ Set-point (apenas Moinhos)
  const ader =
    def.table === "registros_moinho"
      ? rows
          .map((r) => {
            const sp = Number(r["set_point"]);
            const vz = Number(r["vazao"]);
            return sp > 0 && !isNaN(vz) ? (vz / sp) * 100 : null;
          })
          .filter((v): v is number => v != null)
      : [];
  const aderMedia = ader.length ? ader.reduce((a, b) => a + b, 0) / ader.length : null;
  const aderColor =
    aderMedia == null ? "" : aderMedia >= 95 ? "text-green-600" : aderMedia >= 80 ? "text-yellow-600" : "text-destructive";

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
        <h1 className="mb-4 text-base font-bold text-primary sm:text-lg">
          {editId ? `Editar registro — ${def.title}` : `Novo lançamento — ${def.title}`}
        </h1>
        <form onSubmit={save} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <Field label="Data">
            <input className={input} type="date" required value={form.data} onChange={set("data")} />
          </Field>
          <Field label="Hora">
            <input className={input} type="time" required value={form.hora} onChange={set("hora")} />
          </Field>
          {def.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.kind === "select" ? (
                <select className={input} required={f.required} value={form[f.key] ?? ""} onChange={set(f.key)}>
                  <option value="">Selecione…</option>
                  {cads
                    .filter((c) => c.tipo === f.source)
                    .map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  {form[f.key] && !cads.some((c) => c.tipo === f.source && c.nome === form[f.key]) && (
                    <option value={form[f.key]}>{form[f.key]}</option>
                  )}
                </select>
              ) : (
                <input
                  className={input}
                  inputMode={f.kind === "num" ? "decimal" : undefined}
                  required={f.required}
                  value={form[f.key] ?? ""}
                  onChange={set(f.key)}
                />
              )}
            </Field>
          ))}
          <div className="col-span-2 flex items-end gap-2">
            <button className={`${btn} flex-1 sm:flex-none`} disabled={busy}>
              {editId ? "Salvar alterações" : "Lançar"}
            </button>
            {editId && (
              <button
                type="button"
                className="flex-1 rounded-md border px-4 py-2.5 text-sm sm:flex-none sm:py-2"
                onClick={() => {
                  setEditId(null);
                  setForm(empty());
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      </section>

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="text-base font-bold text-primary sm:text-lg">
            Registros {def.title} ({rows.length})
          </h2>
          <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
            <Field label="De">
              <input className={input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Até">
              <input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            {aderMedia != null && (
              <div className="col-span-2 rounded-md border bg-muted/50 px-4 py-1 text-center">
                <span className="block text-xs font-medium text-muted-foreground">Aderência (Vazão ÷ Set-point)</span>
                <span className={`text-lg font-bold ${aderColor}`}>{aderMedia.toFixed(1).replace(".", ",")}%</span>
              </div>
            )}
            <button
              className="rounded-md bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground sm:py-2"
              onClick={exportCsv}
            >
              Excel (CSV)
            </button>
            <button
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground sm:py-2"
              onClick={exportPdf}
            >
              PDF
            </button>
          </div>
        </div>

        {/* Celular: cartões */}
        <ul className="divide-y md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  {brDate(r.data)} · {r.hora.slice(0, 5)}
                </span>
                <div className="flex gap-4 text-sm">
                  <button className="text-primary underline" onClick={() => edit(r)}>
                    Editar
                  </button>
                  <button className="text-destructive underline" onClick={() => remove(r.id)}>
                    Excluir
                  </button>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {def.fields.map((f) => (
                  <div key={f.key} className="flex min-w-0 justify-between gap-2 border-b border-dashed py-0.5">
                    <dt className="truncate text-muted-foreground">{f.label}</dt>
                    <dd className="truncate text-right font-medium">{cell(r, f)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">Nenhum registro ainda.</li>}
        </ul>

        {/* Tablet/desktop: tabela */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                {["Data", "Hora", ...def.fields.map((f) => f.label), ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b odd:bg-muted/50">
                  <td className="whitespace-nowrap px-3 py-2">{brDate(r.data)}</td>
                  <td className="px-3 py-2">{r.hora.slice(0, 5)}</td>
                  {def.fields.map((f) => (
                    <td key={f.key} className="px-3 py-2">
                      {cell(r, f)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2">
                    <button className="mr-3 text-primary underline" onClick={() => edit(r)}>
                      Editar
                    </button>
                    <button className="text-destructive underline" onClick={() => remove(r.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={def.fields.length + 3} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum registro ainda.
                  </td>
                </tr>
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
    <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
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
    try {
      const res = await addCadastro({ data: { tipo, nome } });
      if (!res.ok) return setErr(res.error);
    } catch (e) {
      return setErr(errMsg(e));
    }
    setNome("");
    reload();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este cadastro?")) return;
    try {
      await removeCadastro({ data: { id } });
    } catch (e) {
      setErr(errMsg(e));
    }
    reload();
  }
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 text-base font-bold text-primary sm:text-lg">{title}</h2>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input className={input} required placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <button className={btn}>Adicionar</button>
      </form>
      {err && <p className="mb-2 text-sm text-destructive">{err}</p>}
      <ul className="divide-y">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0 break-words">{c.nome}</span>
            <button className="shrink-0 text-destructive underline" onClick={() => remove(c.id)}>
              Excluir
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nenhum cadastro.</li>}
      </ul>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
