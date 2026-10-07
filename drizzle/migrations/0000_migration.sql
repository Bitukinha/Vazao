CREATE TABLE public.registros_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora time NOT NULL DEFAULT CURRENT_TIME,
  dhz numeric,
  dureza_milho numeric,
  agua_adicionada numeric,
  amp numeric,
  vazao_canjica numeric,
  vazao_germen numeric,
  vazao_milho numeric,
  pct_germen numeric,
  prod_final text,
  nome_resp text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_producao TO authenticated;
GRANT ALL ON public.registros_producao TO service_role;
ALTER TABLE public.registros_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read" ON public.registros_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert" ON public.registros_producao FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "auth update" ON public.registros_producao FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete" ON public.registros_producao FOR DELETE TO authenticated USING (true);