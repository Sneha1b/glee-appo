import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/provider/business")({
  component: BusinessProfile,
  head: () => ({ meta: [{ title: "Business profile — SlotKit" }] }),
});

function BusinessProfile() {
  const { user, loading, businessId, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "", phone: "",
    address_line1: "", address_line2: "", city: "", region: "", postal_code: "", country: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth/provider", search: { mode: "login" } }); return; }
    if (businessId) {
      supabase.from("businesses").select("*").eq("id", businessId).maybeSingle().then(({ data }) => {
        if (data) setForm({
          name: data.name ?? "", category: data.category ?? "", phone: data.phone ?? "",
          address_line1: data.address_line1 ?? "", address_line2: data.address_line2 ?? "",
          city: data.city ?? "", region: data.region ?? "", postal_code: data.postal_code ?? "", country: data.country ?? "",
        });
      });
    }
  }, [loading, user, businessId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      if (businessId) {
        const { error } = await supabase.from("businesses").update(form).eq("id", businessId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("businesses").insert(form).select("id").single();
        if (error) throw error;
        const { error: linkErr } = await supabase.from("business_owners").insert({ user_id: user.id, business_id: data.id });
        if (linkErr) throw linkErr;
      }
      await refresh();
      toast.success("Business saved");
      navigate({ to: "/admin" });
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  }

  if (loading) return <div className="p-12 text-center">Loading…</div>;

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{businessId ? "Edit business" : "Create your business"}</CardTitle>
          <CardDescription>Tell us about your business so customers can find and book you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Hair Salon, Auto Repair…" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            </div>
            <div><Label>Address line 1</Label><Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></div>
            <div><Label>Address line 2</Label><Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
              <div><Label>Postal code</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="size-4 animate-spin" />} Save business
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
