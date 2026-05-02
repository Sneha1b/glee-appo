import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowLeft, Plus, LogOut } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: Admin,
  head: () => ({ meta: [{ title: "Provider — SlotKit" }] }),
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Admin() {
  const { user, loading, businessId, role, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth/provider", search: { mode: "login" } }); return; }
    if (role !== "provider") { navigate({ to: "/auth/provider", search: { mode: "login" } }); return; }
    if (!businessId) { navigate({ to: "/auth/provider/business" }); return; }
  }, [loading, user, businessId, role]);

  if (loading || !user || !businessId) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft /> Customer view</Link>
          </Button>
          <h1 className="font-semibold">Provider dashboard</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth/provider/business">Business profile</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="blocks">Time blocks</TabsTrigger>
          </TabsList>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab businessId={businessId} /></TabsContent>
          <TabsContent value="services"><ServicesTab businessId={businessId} /></TabsContent>
          <TabsContent value="staff"><StaffTab businessId={businessId} /></TabsContent>
          <TabsContent value="blocks"><BlocksTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function BookingsTab() {
  const [rows, setRows] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase
      .from("bookings")
      .select("*, service:service_id(name), staff:staff_id(name)")
      .gte("start_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("start_at");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function cancel(id: string) {
    await supabase.from("bookings").delete().eq("id", id);
    toast.success("Booking cancelled");
    load();
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Upcoming bookings</CardTitle>
        <CardDescription>Showing the past week and forward.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{b.customer_name} · {b.service?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmtDateTime(b.start_at)} · {b.staff?.name} · {b.customer_email}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => cancel(b.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ServicesTab({ businessId }: { businessId: string }) {
  const [services, setServices] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", duration_min: 30, price: 0, description: "", category_id: "" });

  async function load() {
    const [s, c] = await Promise.all([
      supabase.from("services").select("*, category:category_id(name)").eq("business_id", businessId).order("name"),
      supabase.from("service_categories").select("*").eq("business_id", businessId).order("sort_order"),
    ]);
    setServices(s.data ?? []);
    setCats(c.data ?? []);
  }
  useEffect(() => { load(); }, [businessId]);

  async function add() {
    if (!form.name || !form.duration_min) return toast.error("Name and duration required");
    const { error } = await supabase.from("services").insert({
      business_id: businessId,
      name: form.name,
      duration_min: form.duration_min,
      price: form.price,
      description: form.description || null,
      category_id: form.category_id || null,
    });
    if (error) return toast.error(error.message);
    setForm({ name: "", duration_min: 30, price: 0, description: "", category_id: "" });
    toast.success("Service added");
    load();
  }
  async function archive(id: string) {
    await supabase.from("services").update({ active: false }).eq("id", id);
    load();
  }
  async function activate(id: string) {
    await supabase.from("services").update({ active: true }).eq("id", id);
    load();
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {s.name} {!s.active && <Badge variant="secondary">archived</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.category?.name ?? "Uncategorized"} · {s.duration_min} min · ${Number(s.price).toFixed(0)}
                  </p>
                </div>
                {s.active ? (
                  <Button variant="ghost" size="sm" onClick={() => archive(s.id)}>Archive</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => activate(s.id)}>Activate</Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Add service</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Duration (min)</Label><Input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} /></div>
            <div><Label>Price ($)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Button onClick={add} className="w-full"><Plus /> Add service</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StaffTab({ businessId }: { businessId: string }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "" });

  async function load() {
    const [st, sv] = await Promise.all([
      supabase.from("staff").select("*, services:staff_services(service_id), avail:availabilities(*)").eq("business_id", businessId).order("name"),
      supabase.from("services").select("id,name").eq("business_id", businessId).eq("active", true),
    ]);
    setStaff(st.data ?? []);
    setServices(sv.data ?? []);
  }
  useEffect(() => { load(); }, [businessId]);

  async function add() {
    if (!form.name) return toast.error("Name required");
    const { error } = await supabase.from("staff").insert({
      business_id: businessId, name: form.name,
    });
    if (error) return toast.error(error.message);
    setForm({ name: "" });
    load();
  }
  async function remove(id: string) {
    await supabase.from("staff").delete().eq("id", id);
    load();
  }
  async function toggleService(staffId: string, serviceId: string, on: boolean) {
    if (on) await supabase.from("staff_services").insert({ staff_id: staffId, service_id: serviceId });
    else await supabase.from("staff_services").delete().eq("staff_id", staffId).eq("service_id", serviceId);
    load();
  }
  async function setHours(staffId: string, weekday: number, startH: number, endH: number) {
    await supabase.from("availabilities").delete().eq("staff_id", staffId).eq("weekday", weekday);
    if (endH > startH) {
      await supabase.from("availabilities").insert({
        staff_id: staffId, weekday, start_minute: startH * 60, end_minute: endH * 60,
      });
    }
    load();
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {staff.map((s) => {
          const svcIds = new Set(s.services.map((x: any) => x.service_id));
          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider">Services performed</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {services.map((svc) => {
                      const on = svcIds.has(svc.id);
                      return (
                        <Button
                          key={svc.id}
                          size="sm"
                          variant={on ? "default" : "outline"}
                          onClick={() => toggleService(s.id, svc.id, !on)}
                        >
                          {svc.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider">Weekly hours</Label>
                  <div className="mt-2 space-y-1.5">
                    {WEEKDAYS.map((wd, i) => {
                      const a = s.avail.find((x: any) => x.weekday === i);
                      const startH = a ? Math.floor(a.start_minute / 60) : 0;
                      const endH = a ? Math.floor(a.end_minute / 60) : 0;
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-10 text-muted-foreground">{wd}</span>
                          <Input type="number" min={0} max={24} className="h-8 w-20" defaultValue={startH}
                            onBlur={(e) => setHours(s.id, i, Number(e.target.value), endH || Number(e.target.value) + 8)} />
                          <span className="text-muted-foreground">to</span>
                          <Input type="number" min={0} max={24} className="h-8 w-20" defaultValue={endH}
                            onBlur={(e) => setHours(s.id, i, startH, Number(e.target.value))} />
                          <span className="text-muted-foreground">(0 to 0 = off)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Add staff</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <Button onClick={add} className="w-full"><Plus /> Add staff</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BlocksTab() {
  const [staff, setStaff] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [form, setForm] = useState({ staff_id: "", start: "", end: "", reason: "" });

  async function load() {
    const [s, b] = await Promise.all([
      supabase.from("staff").select("id,name").order("name"),
      supabase.from("time_blocks").select("*, staff:staff_id(name)").gte("end_at", new Date().toISOString()).order("start_at"),
    ]);
    setStaff(s.data ?? []);
    setBlocks(b.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.staff_id || !form.start || !form.end) return toast.error("All fields required");
    const { error } = await supabase.from("time_blocks").insert({
      staff_id: form.staff_id,
      start_at: new Date(form.start).toISOString(),
      end_at: new Date(form.end).toISOString(),
      reason: form.reason || null,
    });
    if (error) return toast.error(error.message);
    setForm({ staff_id: "", start: "", end: "", reason: "" });
    toast.success("Block added");
    load();
  }
  async function remove(id: string) {
    await supabase.from("time_blocks").delete().eq("id", id);
    load();
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming time blocks</CardTitle></CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks scheduled.</p>
          ) : (
            <ul className="divide-y">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{b.staff?.name} — {b.reason ?? "blocked"}</p>
                    <p className="text-sm text-muted-foreground">
                      {fmtDateTime(b.start_at)} → {fmtDateTime(b.end_at)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Add block</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Staff</Label>
            <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
              <SelectTrigger><SelectValue placeholder="Pick staff" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Start</Label><Input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
          <div><Label>End</Label><Input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
          <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <Button onClick={add} className="w-full"><Plus /> Add block</Button>
        </CardContent>
      </Card>
    </div>
  );
}
