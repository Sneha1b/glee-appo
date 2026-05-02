CREATE POLICY "no direct access to slot_locks" ON public.slot_locks
  FOR ALL TO public
  USING (false) WITH CHECK (false);