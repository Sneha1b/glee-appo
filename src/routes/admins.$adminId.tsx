import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { Trash2, ArrowLeft, Plus, LogOut, Save, ChevronRight, Download, Store, AlertTriangle } from "lucide-react";
import { MetricsTab } from "@/components/admin/MetricsTab";
import { Calendar } from "@/components/ui/calendar";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  checkBusinessOwnership,
  listAdminBookings,
  listAdminServices,
  listAdminCategories,
  upsertAdminService,
  setAdminServiceActive,
  createAdminCategory,
  deleteAdminCategory,
  listAdminStaff,
  createAdminStaff,
  deleteAdminStaff,
  toggleStaffServiceFn,
  setStaffWeekdayHours,
  listAdminTimeBlocks,
  createAdminTimeBlock,
  deleteAdminTimeBlock,
  listAdminStoreHours,
  setStoreHoursFn,
  listAdminClosures,
  createAdminClosure,
  deleteAdminClosure,
  getBusinessProfileFn,
  updateBusinessProfileFn,
  listAdminInvoices,
  presignBusinessImageFn,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admins/$adminId")({
  component: Admin,
  head: () => ({ meta: [{ title: "Provider — Schedora" }] }),
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function downloadInvoicePdf(r: any) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const left = 56;
  let y = 64;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("INVOICE", left, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`#${r.invoice_number}`, left, y + 18);
  doc.text(`Issued: ${new Date(r.issued_at).toLocaleDateString()}`, left, y + 32);

  y = 130;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Bill to", left, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(r.customer_name ?? "", left, y + 16);
  doc.text(r.customer_email ?? "", left, y + 30);
  if (r.customer_phone) doc.text(r.customer_phone, left, y + 44);

  y = 210;
  doc.setDrawColor(220); doc.line(left, y, 540, y);
  y += 22;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Service", left, y); doc.text("Staff", 290, y); doc.text("When", 380, y);
  doc.text("Amount", 540, y, { align: "right" });
  y += 8; doc.line(left, y, 540, y); y += 18;
  doc.setFont("helvetica", "normal");
  doc.text(String(r.service_name ?? ""), left, y);
  doc.text(String(r.staff_name ?? "—"), 290, y);
  doc.text(new Date(r.appointment_at).toLocaleString(), 380, y);
  doc.text(`${r.currency} ${Number(r.amount).toFixed(2)}`, 540, y, { align: "right" });
  y += 30; doc.line(left, y, 540, y);

  y += 24; doc.setFont("helvetica", "bold");
  doc.text("Total", 380, y);
  doc.text(`${r.currency} ${Number(r.total).toFixed(2)}`, 540, y, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text("Status: " + (r.status ?? "issued"), left, y);

  doc.setTextColor(150);
  doc.text("Powered by Schedora", left, 740);
  doc.save(`${r.invoice_number}.pdf`);
}

function Admin() {
  const { adminId } = useParams({ from: "/admins/$adminId" });
  const { user, loading, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [ownership, setOwnership] = useState<"checking" | "owner" | "denied">("checking");
  const checkOwn = useServerFn(checkBusinessOwnership);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth/provider", search: { mode: "login" } }); return; }
    if (role === null) return;
    if (role !== "provider") { navigate({ to: "/auth/provider", search: { mode: "login" } }); return; }
    let cancelled = false;
    setOwnership("checking");
    (async () => {
      try {
        const res = await checkOwn({ data: { businessId: adminId } });
        if (cancelled) return;
        if (!res.ok) { setOwnership("denied"); navigate({ to: "/provider", replace: true }); return; }
        setOwnership("owner");
      } catch {
        if (!cancelled) { setOwnership("denied"); navigate({ to: "/provider", replace: true }); }
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user?.id, role, adminId]);

  if (loading || !user || ownership !== "owner")
    return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  const businessId = adminId;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/provider"><ArrowLeft /> Your businesses</Link>
          </Button>
          <h1 className="font-semibold">Provider dashboard</h1>
          <div className="ml-auto flex items-center gap-2">
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
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="store">Store</TabsTrigger>
            <TabsTrigger value="blocks">Time blocks</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
          <TabsContent value="bookings"><BookingsTab businessId={businessId} adminId={adminId} /></TabsContent>
          <TabsContent value="services"><ServicesTab businessId={businessId} /></TabsContent>
          <TabsContent value="staff"><StaffTab businessId={businessId} /></TabsContent>
          <TabsContent value="store"><StoreTab businessId={businessId} /></TabsContent>
          <TabsContent value="blocks"><BlocksTab businessId={businessId} /></TabsContent>
          <TabsContent value="metrics"><MetricsTab businessId={businessId} /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab businessId={businessId} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function BookingsTab({ businessId, adminId }: { businessId: string; adminId: string }) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [rows, setRows] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [filters, setFilters] = useState({
    from: new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10),
    to: new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10),
    staff_id: "all",
    service_id: "all",
  });
  const [calMonth, setCalMonth] = useState<Date>(today);
  const fnList = useServerFn(listAdminBookings);
  const fnStaff = useServerFn(listAdminStaff);
  const fnSvc = useServerFn(listAdminServices);

  async function load() {
    const data = await fnList({
      data: {
        businessId,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to + "T23:59:59").toISOString() : undefined,
        staffId: filters.staff_id !== "all" ? filters.staff_id : null,
        serviceId: filters.service_id !== "all" ? filters.service_id : null,
      },
    });
    setRows(data ?? []);
  }
  useEffect(() => {
    Promise.all([
      fnStaff({ data: { businessId } }),
      fnSvc({ data: { businessId } }),
    ]).then(([s, sv]) => {
      setStaff((s ?? []).map((x: any) => ({ id: x.id, name: x.name })));
      setServices((sv ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    });
  }, [businessId]);
  useEffect(() => { load(); }, [businessId, filters]);

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const b of rows) {
      const d = new Date(b.start_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(b);
    }
    return m;
  }, [rows]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Bookings</CardTitle>
        <CardDescription>Click any booking to view details, reschedule or cancel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div><Label className="text-xs">From</Label><Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Staff</Label>
            <Select value={filters.staff_id} onValueChange={(v) => setFilters({ ...filters, staff_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Service</Label>
            <Select value={filters.service_id} onValueChange={(v) => setFilters({ ...filters, service_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="list">List ({rows.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="mt-4">
            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <Calendar
                mode="single"
                month={calMonth}
                onMonthChange={setCalMonth}
                modifiers={{ booked: (d) => byDay.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`) }}
                modifiersClassNames={{ booked: "bg-primary/15 font-semibold text-primary rounded-md" }}
                className="pointer-events-auto rounded-md border p-2"
              />
              <div className="space-y-3">
                {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => (
                  <div key={day}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {new Date(day + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <ul className="divide-y rounded-md border">
                      {items.map((b) => (
                        <li key={b.id}>
                          <Link
                            to="/admins/$adminId/bookings/$bookingId"
                            params={{ adminId, bookingId: b.id }}
                            className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {fmtTime(b.start_at)} · {b.service?.name}
                                {b.status === "cancelled" && <Badge variant="destructive" className="ml-2">cancelled</Badge>}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{b.customer_name} · {b.staff?.name}</p>
                            </div>
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {byDay.size === 0 && (
                  <p className="text-sm text-muted-foreground">No bookings match these filters.</p>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="list" className="mt-4">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings match these filters.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {rows.map((b) => (
                  <li key={b.id}>
                    <Link
                      to="/admins/$adminId/bookings/$bookingId"
                      params={{ adminId, bookingId: b.id }}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {b.customer_name} · {b.service?.name}
                          {b.status === "cancelled" && <Badge variant="destructive" className="ml-2">cancelled</Badge>}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {fmtDateTime(b.start_at)} · {b.staff?.name} · {b.customer_email}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ServicesTab({ businessId }: { businessId: string }) {
  const [services, setServices] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const empty = { name: "", duration_min: 30, price: 0, description: "", category_id: "", available_from: "" };
  const [form, setForm] = useState<any>(empty);
  const [newCat, setNewCat] = useState("");
  const fnSvc = useServerFn(listAdminServices);
  const fnCats = useServerFn(listAdminCategories);
  const fnUpsert = useServerFn(upsertAdminService);
  const fnSetActive = useServerFn(setAdminServiceActive);
  const fnAddCat = useServerFn(createAdminCategory);
  const fnDelCat = useServerFn(deleteAdminCategory);

  async function load() {
    const [s, c] = await Promise.all([
      fnSvc({ data: { businessId } }),
      fnCats({ data: { businessId } }),
    ]);
    setServices(s ?? []);
    setCats(c ?? []);
  }
  useEffect(() => { load(); }, [businessId]);

  function startEdit(s: any) {
    setEditingId(s.id);
    setForm({
      name: s.name ?? "",
      duration_min: s.duration_min ?? 30,
      price: Number(s.price ?? 0),
      description: s.description ?? "",
      category_id: s.category_id ?? "",
      available_from: s.available_from ? new Date(s.available_from).toISOString().slice(0, 10) : "",
    });
  }
  function cancelEdit() { setEditingId(null); setForm(empty); }

  async function save() {
    if (!form.name || !form.duration_min) return toast.error("Name and duration required");
    try {
      await fnUpsert({
        data: {
          businessId,
          id: editingId ?? null,
          name: form.name,
          duration_min: Number(form.duration_min),
          price: Number(form.price),
          description: form.description || null,
          category_id: form.category_id || null,
          available_from: form.available_from ? new Date(form.available_from).toISOString() : null,
        },
      });
      toast.success(editingId ? "Service updated" : "Service added");
      cancelEdit();
      load();
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  }
  async function archive(id: string) {
    await fnSetActive({ data: { businessId, id, active: false } });
    load();
  }
  async function activate(id: string) {
    await fnSetActive({ data: { businessId, id, active: true } });
    load();
  }

  async function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Category already exists");
      return;
    }
    try {
      await fnAddCat({ data: { businessId, name, sortOrder: cats.length } });
      setNewCat("");
      toast.success("Category added");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function removeCategory(id: string) {
    if (services.some((s) => s.category_id === id)) {
      toast.error("Category is in use — reassign those services first.");
      return;
    }
    try { await fnDelCat({ data: { businessId, id } }); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No services yet — add one on the right.</p>
          ) : (
            <ul className="divide-y">
              {services.map((s) => {
                const upcoming = s.available_from && new Date(s.available_from) > new Date();
                return (
                  <li key={s.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">
                        {s.name}{" "}
                        {!s.active && <Badge variant="secondary">archived</Badge>}
                        {upcoming && <Badge className="ml-1">launches {new Date(s.available_from).toLocaleDateString()}</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {s.category?.name ?? "Uncategorized"} · {s.duration_min} min · ${Number(s.price).toFixed(0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>Edit</Button>
                      {s.active ? (
                        <Button variant="ghost" size="sm" onClick={() => archive(s.id)}>Archive</Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => activate(s.id)}>Activate</Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
            <CardDescription>Group your services so customers can browse them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Haircuts"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
              />
              <Button onClick={addCategory} type="button"><Plus /> Add</Button>
            </div>
            {cats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <li key={c.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-sm">
                    {c.name}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeCategory(c.id)}
                      title="Remove category"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Edit service" : "Add service"}</CardTitle>
            <CardDescription>Use the launch date for services that aren't bookable yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Duration (min)</Label><Input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} /></div>
              <div><Label>Price ($)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder={cats.length ? "Pick a category" : "Add a category first"} /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Available from <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="date"
                value={form.available_from}
                onChange={(e) => setForm({ ...form, available_from: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Hide from booking until this date.</p>
            </div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex gap-2">
              <Button onClick={save} className="flex-1">
                {editingId ? <><Save /> Save changes</> : <><Plus /> Add service</>}
              </Button>
              {editingId && <Button variant="outline" onClick={cancelEdit}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StaffTab({ businessId }: { businessId: string }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [hourErrors, setHourErrors] = useState<Record<number, string>>({});
  const fnStaff = useServerFn(listAdminStaff);
  const fnSvc = useServerFn(listAdminServices);
  const fnAdd = useServerFn(createAdminStaff);
  const fnDel = useServerFn(deleteAdminStaff);
  const fnToggleSvc = useServerFn(toggleStaffServiceFn);
  const fnHours = useServerFn(setStaffWeekdayHours);

  async function load() {
    const [st, sv] = await Promise.all([
      fnStaff({ data: { businessId } }),
      fnSvc({ data: { businessId } }),
    ]);
    setStaff(st ?? []);
    setServices((sv ?? []).filter((x: any) => x.active !== false).map((x: any) => ({ id: x.id, name: x.name })));
    if (!selectedId && st && st.length) setSelectedId(st[0].id);
  }
  useEffect(() => { load(); }, [businessId]);

  const selected = useMemo(() => staff.find((s) => s.id === selectedId), [staff, selectedId]);

  async function addStaff() {
    if (!newName.trim()) return toast.error("Name required");
    try {
      const r = await fnAdd({ data: { businessId, name: newName.trim() } });
      setNewName("");
      toast.success("Staff added");
      if (r?.id) setSelectedId(r.id);
      load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function removeStaff(id: string) {
    await fnDel({ data: { businessId, staffId: id } });
    setSelectedId("");
    load();
  }
  async function toggleService(staffId: string, serviceId: string, on: boolean) {
    await fnToggleSvc({ data: { businessId, staffId, serviceId, on } });
    load();
  }
  async function setHours(staffId: string, weekday: number, startH: number, endH: number) {
    if (Number.isNaN(startH) || Number.isNaN(endH) || startH < 0 || endH < 0 || startH > 24 || endH > 24) {
      setHourErrors((m) => ({ ...m, [weekday]: "Hours must be between 0 and 24." }));
      return;
    }
    if (endH !== 0 && endH <= startH) {
      setHourErrors((m) => ({ ...m, [weekday]: "End hour must be greater than start hour." }));
      return;
    }
    setHourErrors((m) => { const c = { ...m }; delete c[weekday]; return c; });
    await fnHours({
      data: {
        businessId, staffId, weekday,
        startMinute: endH > startH ? startH * 60 : null,
        endMinute: endH > startH ? endH * 60 : null,
      },
    });
    load();
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit staff member</CardTitle>
          <CardDescription>Pick a team member to manage their services and weekly hours.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff yet — add one on the right.</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select a staff member" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selected && (
                  <Button variant="ghost" size="icon" onClick={() => removeStaff(selected.id)} title="Remove staff">
                    <Trash2 />
                  </Button>
                )}
              </div>
              {selected && (
                <>
                  <div>
                    <Label className="text-xs uppercase tracking-wider">Services performed</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {services.map((svc) => {
                        const on = new Set(selected.services.map((x: any) => x.service_id)).has(svc.id);
                        return (
                          <Button
                            key={svc.id}
                            size="sm"
                            variant={on ? "default" : "outline"}
                            onClick={() => toggleService(selected.id, svc.id, !on)}
                          >
                            {svc.name}
                          </Button>
                        );
                      })}
                      {services.length === 0 && <p className="text-sm text-muted-foreground">Add services first.</p>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider">Weekly hours</Label>
                    <div className="mt-2 space-y-1.5">
                      {WEEKDAYS.map((wd, i) => {
                        const a = selected.avail.find((x: any) => x.weekday === i);
                        const startH = a ? Math.floor(a.start_minute / 60) : 0;
                        const endH = a ? Math.floor(a.end_minute / 60) : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="w-10 text-muted-foreground">{wd}</span>
                              <Input
                                type="number" min={0} max={24} className="h-8 w-20"
                                defaultValue={startH}
                                key={`s-${selected.id}-${i}-${a?.id ?? "x"}`}
                                onBlur={(e) => setHours(selected.id, i, Number(e.target.value), endH || Number(e.target.value) + 8)}
                              />
                              <span className="text-muted-foreground">to</span>
                              <Input
                                type="number" min={0} max={24} className="h-8 w-20"
                                defaultValue={endH}
                                key={`e-${selected.id}-${i}-${a?.id ?? "x"}`}
                                onBlur={(e) => setHours(selected.id, i, startH, Number(e.target.value))}
                              />
                            </div>
                            {hourErrors[i] && (
                              <p className="ml-12 text-xs text-destructive">{hourErrors[i]}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Add staff</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
          <Button onClick={addStaff} className="w-full"><Plus /> Add staff</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BlocksTab({ businessId }: { businessId: string }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [form, setForm] = useState({ staff_id: "", start: "", end: "", reason: "" });
  const fnList = useServerFn(listAdminTimeBlocks);
  const fnStaff = useServerFn(listAdminStaff);
  const fnAdd = useServerFn(createAdminTimeBlock);
  const fnDel = useServerFn(deleteAdminTimeBlock);

  async function load() {
    const [s, b] = await Promise.all([
      fnStaff({ data: { businessId } }),
      fnList({ data: { businessId } }),
    ]);
    setStaff((s ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    setBlocks(b ?? []);
  }
  useEffect(() => { load(); }, [businessId]);

  async function add() {
    if (!form.staff_id || !form.start || !form.end) return toast.error("All fields required");
    try {
      await fnAdd({
        data: {
          businessId,
          staffId: form.staff_id,
          startAt: new Date(form.start).toISOString(),
          endAt: new Date(form.end).toISOString(),
          reason: form.reason || null,
        },
      });
      setForm({ staff_id: "", start: "", end: "", reason: "" });
      toast.success("Block added");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function remove(id: string) {
    await fnDel({ data: { businessId, id } });
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

function StoreTab({ businessId }: { businessId: string }) {
  const [hours, setHours] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [hourErrors, setHourErrors] = useState<Record<number, string>>({});
  const [newClosure, setNewClosure] = useState({ from_date: "", to_date: "", reason: "" });
  const [profile, setProfile] = useState<{ name: string; description: string; logo_url: string | null }>({
    name: "", description: "", logo_url: null,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const fnHours = useServerFn(listAdminStoreHours);
  const fnSetHours = useServerFn(setStoreHoursFn);
  const fnClosures = useServerFn(listAdminClosures);
  const fnAddClosure = useServerFn(createAdminClosure);
  const fnDelClosure = useServerFn(deleteAdminClosure);
  const fnGetProf = useServerFn(getBusinessProfileFn);
  const fnUpdProf = useServerFn(updateBusinessProfileFn);
  const fnPresign = useServerFn(presignBusinessImageFn);

  async function load() {
    const [h, c, b] = await Promise.all([
      fnHours({ data: { businessId } }),
      fnClosures({ data: { businessId } }),
      fnGetProf({ data: { businessId } }),
    ]);
    setHours(h ?? []);
    setClosures(c ?? []);
    if (b) setProfile({ name: b.name ?? "", description: b.description ?? "", logo_url: b.logo_url ?? null });
  }
  useEffect(() => { load(); }, [businessId]);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const presign = await fnPresign({ data: { contentType: file.type || "application/octet-stream", ext } });
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      setProfile((p) => ({ ...p, logo_url: presign.publicUrl }));
      toast.success("Logo uploaded — don't forget to save");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally { setUploadingLogo(false); }
  }

  async function saveProfile() {
    if (!profile.name.trim()) { toast.error("Name is required"); return; }
    setSavingProfile(true);
    try {
      await fnUpdProf({
        data: {
          businessId,
          name: profile.name.trim(),
          description: profile.description.trim() || null,
          logo_url: profile.logo_url,
        },
      });
      toast.success("Business profile updated");
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSavingProfile(false); }
  }

  async function setDayHours(weekday: number, openH: number, closeH: number) {
    if (Number.isNaN(openH) || Number.isNaN(closeH) || openH < 0 || closeH < 0 || openH > 24 || closeH > 24) {
      setHourErrors((m) => ({ ...m, [weekday]: "Hours must be between 0 and 24." }));
      return;
    }
    if (closeH !== 0 && closeH <= openH) {
      setHourErrors((m) => ({ ...m, [weekday]: "Close hour must be greater than open hour." }));
      return;
    }
    setHourErrors((m) => { const c = { ...m }; delete c[weekday]; return c; });
    await fnSetHours({
      data: {
        businessId, weekday,
        openMinute: closeH > openH ? openH * 60 : null,
        closeMinute: closeH > openH ? closeH * 60 : null,
      },
    });
    await load();
  }

  async function addClosure() {
    if (!newClosure.from_date) return toast.error("Pick a start date");
    const to = newClosure.to_date || newClosure.from_date;
    try {
      await fnAddClosure({
        data: {
          businessId,
          from_date: newClosure.from_date,
          to_date: to,
          reason: newClosure.reason || null,
        },
      });
      setNewClosure({ from_date: "", to_date: "", reason: "" });
      toast.success("Closure added");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function removeClosure(id: string) {
    await fnDelClosure({ data: { businessId, id } });
    load();
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="size-4" /> Business profile
          </CardTitle>
          <CardDescription>
            This is what customers see at the top of your booking page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <Label className="text-xs">Logo</Label>
              <div className="size-24 overflow-hidden rounded-lg border bg-muted/40 grid place-items-center">
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt="Logo" className="size-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <Input type="file" accept="image/*" onChange={uploadLogo} disabled={uploadingLogo} className="h-8 text-xs" />
              {profile.logo_url && (
                <Button
                  variant="ghost" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => setProfile((p) => ({ ...p, logo_url: null }))}
                >
                  Remove logo
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="biz-name" className="text-xs">Business name</Label>
                <Input
                  id="biz-name"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Glee Salon"
                />
              </div>
              <div>
                <Label htmlFor="biz-desc" className="text-xs">Description</Label>
                <Textarea
                  id="biz-desc"
                  value={profile.description}
                  onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Tell customers what makes your business special…"
                  rows={3}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={savingProfile} className="gap-2">
                  <Save className="size-4" /> {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_360px]">
        <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="size-4" /> Store hours
          </CardTitle>
          <CardDescription>
            Set when the business is open. Set both to 0 for a closed day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {WEEKDAYS.map((wd, i) => {
              const h = hours.find((x) => x.weekday === i);
              const openH = h ? Math.floor(h.open_minute / 60) : 0;
              const closeH = h ? Math.floor(h.close_minute / 60) : 0;
              const isClosed = !h || h.close_minute <= h.open_minute;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-12 text-muted-foreground">{wd}</span>
                    <Input
                      type="number" min={0} max={24} className="h-8 w-20"
                      defaultValue={openH}
                      key={`o-${i}-${h?.id ?? "x"}`}
                      onBlur={(e) => setDayHours(i, Number(e.target.value), closeH || Number(e.target.value) + 8)}
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="number" min={0} max={24} className="h-8 w-20"
                      defaultValue={closeH}
                      key={`c-${i}-${h?.id ?? "x"}`}
                      onBlur={(e) => setDayHours(i, openH, Number(e.target.value))}
                    />
                    {isClosed && <Badge variant="secondary" className="ml-1 text-xs">closed</Badge>}
                  </div>
                  {hourErrors[i] && (
                    <p className="ml-14 text-xs text-destructive">{hourErrors[i]}</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Per-staff hours under <b>Staff</b> still apply within these store hours.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Closures & off days</CardTitle>
          <CardDescription>Block out a single day or a date range (holidays, training, etc.).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {closures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming closures.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {closures.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {new Date(c.from_date + "T00:00:00").toLocaleDateString()}
                      {c.from_date !== c.to_date && (
                        <> → {new Date(c.to_date + "T00:00:00").toLocaleDateString()}</>
                      )}
                    </p>
                    {c.reason && <p className="truncate text-xs text-muted-foreground">{c.reason}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeClosure(c.id)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add closure</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={newClosure.from_date}
                  onChange={(e) => setNewClosure({ ...newClosure, from_date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">To <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="date" value={newClosure.to_date}
                  onChange={(e) => setNewClosure({ ...newClosure, to_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Reason</Label>
              <Input value={newClosure.reason} placeholder="Holiday, training…"
                onChange={(e) => setNewClosure({ ...newClosure, reason: e.target.value })} />
            </div>
            <Button onClick={addClosure} className="w-full"><Plus /> Add closure</Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function InvoicesTab({ businessId }: { businessId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    from: "", to: "", staff_id: "all", service_id: "all",
  });
  const fnInv = useServerFn(listAdminInvoices);
  const fnStaff = useServerFn(listAdminStaff);
  const fnSvc = useServerFn(listAdminServices);

  async function load() {
    const data = await fnInv({
      data: {
        businessId,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to + "T23:59:59").toISOString() : undefined,
        staffId: filters.staff_id !== "all" ? filters.staff_id : null,
        serviceId: filters.service_id !== "all" ? filters.service_id : null,
      },
    });
    setRows(data ?? []);
  }
  useEffect(() => {
    Promise.all([
      fnStaff({ data: { businessId } }),
      fnSvc({ data: { businessId } }),
    ]).then(([s, sv]) => {
      setStaff((s ?? []).map((x: any) => ({ id: x.id, name: x.name })));
      setServices((sv ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    });
  }, [businessId]);
  useEffect(() => { load(); }, [businessId, filters]);

  const total = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Invoices</CardTitle>
        <CardDescription>Auto-generated on each booking. Retained for 18 months.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div><Label className="text-xs">From</Label><Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Staff</Label>
            <Select value={filters.staff_id} onValueChange={(v) => setFilters({ ...filters, staff_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Service</Label>
            <Select value={filters.service_id} onValueChange={(v) => setFilters({ ...filters, service_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices match these filters.</p>
        ) : (
          <>
            <ul className="divide-y rounded-md border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.invoice_number} · {r.service_name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {fmtDateTime(r.issued_at)} · {r.customer_name} · {r.staff_name ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{r.currency} {Number(r.total).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{r.status}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadInvoicePdf(r)}>
                      <Download /> PDF
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-end border-t pt-3 text-sm">
              <span className="text-muted-foreground">Total:&nbsp;</span>
              <span className="font-semibold">${total.toFixed(2)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
