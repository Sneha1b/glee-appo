CREATE POLICY "owners update bookings" ON public.bookings
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM business_owners bo WHERE bo.business_id = bookings.business_id AND bo.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM business_owners bo WHERE bo.business_id = bookings.business_id AND bo.user_id = auth.uid()));