GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_producao TO anon;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='registros_producao' LOOP
    EXECUTE format('DROP POLICY %I ON public.registros_producao', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "Acesso publico" ON public.registros_producao FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);