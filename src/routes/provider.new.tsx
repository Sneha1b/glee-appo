import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Plus, X, Upload } from "lucide-react";

export const Route = createFileRoute("/provider/new")({
  component: NewBusiness,
  head: () => ({ meta: [{ title: "Add a business — Schedora" }] }),
});

function NewBusiness() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [managerEmail, setManagerEmail] = useState("");
  const [managers, setManagers] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", category: "", description: "", phone: "",
    address_line1: "", city: "", region: "", postal_code: "", country: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth/provider", search: { mode: "login" } });
  }, [loading, user]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("business-images").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("business-images").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally { setUploading(false); }
  }

  function addManager() {
    const v = managerEmail.trim().toLowerCase();
    if (!v || !v.includes("@")) { toast.error("Enter a valid email"); return; }
    if (managers.includes(v)) { setManagerEmail(""); return; }
    setManagers([...managers, v]);
    setManagerEmail("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) { toast.error("Business name is required"); return; }
    setBusy(true);
    try {
      const { data: newId, error } = await supabase.rpc("create_business_with_owner", {
        p_name: form.name,
        p_category: form.category || undefined,
        p_phone: form.phone || undefined,
        p_description: form.description || undefined,
        p_address_line1: form.address_line1 || undefined,
        p_city: form.city || undefined,
        p_region: form.region || undefined,
        p_postal_code: form.postal_code || undefined,
        p_country: form.country || undefined,
        p_logo_url: logoUrl || undefined,
      });
      if (error) throw error;
      const businessId = newId as unknown as string;

      // Send manager invites
      for (const email of managers) {
        const { error: inviteErr } = await supabase.rpc("invite_business_manager" as any, {
          p_business_id: businessId, p_email: email,
        });
        if (inviteErr) console.warn("invite failed", email, inviteErr.message);
      }

      toast.success("Business created");
      navigate({ to: "/businesses/$businessId", params: { businessId } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create business");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="p-12 text-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/provider" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-4" /> Back to your businesses
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Add a new business</CardTitle>
            <CardDescription>Fill in the details below. You can edit anything later.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-5">
              {/* Logo */}
              <div>
                <Label>Business image</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="size-20 rounded-md border bg-muted overflow-hidden grid place-items-center">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <Input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
                    <p className="text-xs text-muted-foreground mt-1">PNG/JPG, used as logo on your booking page.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Business name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Hair Salon, Auto Repair…" /></div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell customers what you offer." />
              </div>

              <div>
                <Label>Location</Label>
                <Input className="mt-1" placeholder="Address" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-3 mt-2">
                  <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  <Input placeholder="Region/State" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                  <Input placeholder="Postal code" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 mt-2">
                  <Input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              {/* Manager invites */}
              <div>
                <Label>Invite other providers (by email)</Label>
                <p className="text-xs text-muted-foreground mb-2">They'll become co-managers of this business when they sign in.</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="provider@example.com"
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManager(); } }}
                  />
                  <Button type="button" variant="outline" onClick={addManager} className="gap-1">
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
                {managers.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {managers.map((m) => (
                      <li key={m} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-sm">
                        {m}
                        <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setManagers(managers.filter((x) => x !== m))}>
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button type="submit" disabled={busy || uploading} className="w-full">
                {busy && <Loader2 className="size-4 animate-spin" />} Create business
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
