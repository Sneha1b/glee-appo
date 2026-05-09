import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { presignBusinessImageFn, createBusinessFullFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Plus, X, Upload, Check, Trash2 } from "lucide-react";

export const Route = createFileRoute("/provider/new")({
  component: NewBusiness,
  head: () => ({ meta: [{ title: "Add a business — Schedora" }] }),
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayHours = { open: number; close: number; closed: boolean };
type WizardCategory = { tempId: string; name: string };
type WizardService = {
  tempId: string;
  name: string;
  duration_min: number;
  price: number;
  description: string;
  categoryTempId: string; // "" = none
};
type WizardStaff = {
  tempId: string;
  name: string;
  serviceTempIds: string[];
  hours: DayHours[]; // length 7
};

const STEPS = [
  "Business info",
  "Location",
  "Store hours",
  "Categories",
  "Services",
  "Staff",
  "Review",
] as const;

function defaultHours(): DayHours[] {
  // Mon–Fri 9–17 open, Sat/Sun closed
  return Array.from({ length: 7 }, (_, i) => ({
    open: 9,
    close: 17,
    closed: i === 0 || i === 6,
  }));
}

function NewBusiness() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [info, setInfo] = useState({ name: "", category: "", description: "", phone: "", logoUrl: "" });
  const [location, setLocation] = useState({ address_line1: "", city: "", region: "", postal_code: "", country: "" });
  const [hours, setHours] = useState<DayHours[]>(defaultHours());
  const [categories, setCategories] = useState<WizardCategory[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [services, setServices] = useState<WizardService[]>([]);
  const [svcDraft, setSvcDraft] = useState<WizardService>({
    tempId: "", name: "", duration_min: 30, price: 0, description: "", categoryTempId: "",
  });
  const [staff, setStaff] = useState<WizardStaff[]>([]);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffDraftName, setStaffDraftName] = useState("");
  const [managers, setManagers] = useState<string[]>([]);
  const [managerEmail, setManagerEmail] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth/provider", search: { mode: "login" } });
  }, [loading, user]);

  const presignFn = useServerFn(presignBusinessImageFn);
  const createBizFn = useServerFn(createBusinessFullFn);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const presign = await presignFn({ data: { contentType: file.type || "application/octet-stream", ext } });
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      setInfo((s) => ({ ...s, logoUrl: presign.publicUrl }));
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally { setUploading(false); }
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Category already added"); return;
    }
    setCategories((cs) => [...cs, { tempId: crypto.randomUUID(), name }]);
    setNewCatName("");
  }
  function removeCategory(tempId: string) {
    setCategories((cs) => cs.filter((c) => c.tempId !== tempId));
    setServices((ss) => ss.map((s) => s.categoryTempId === tempId ? { ...s, categoryTempId: "" } : s));
  }

  function addService() {
    if (!svcDraft.name.trim()) { toast.error("Service name required"); return; }
    if (!svcDraft.duration_min || svcDraft.duration_min <= 0) { toast.error("Duration required"); return; }
    setServices((ss) => [...ss, { ...svcDraft, tempId: crypto.randomUUID() }]);
    setSvcDraft({ tempId: "", name: "", duration_min: 30, price: 0, description: "", categoryTempId: "" });
  }
  function removeService(tempId: string) {
    setServices((ss) => ss.filter((s) => s.tempId !== tempId));
    setStaff((st) => st.map((s) => ({ ...s, serviceTempIds: s.serviceTempIds.filter((x) => x !== tempId) })));
  }

  function addStaff() {
    const name = staffDraftName.trim();
    if (!name) return;
    const newSt: WizardStaff = {
      tempId: crypto.randomUUID(),
      name,
      serviceTempIds: services.map((s) => s.tempId), // default: performs all services
      hours: hours.map((h) => ({ ...h })),
    };
    setStaff((s) => [...s, newSt]);
    setStaffDraftName("");
    setEditingStaffId(newSt.tempId);
  }
  function removeStaff(tempId: string) {
    setStaff((s) => s.filter((x) => x.tempId !== tempId));
    if (editingStaffId === tempId) setEditingStaffId(null);
  }
  function toggleStaffService(tempId: string, svcTempId: string) {
    setStaff((all) => all.map((s) => s.tempId !== tempId ? s : ({
      ...s,
      serviceTempIds: s.serviceTempIds.includes(svcTempId)
        ? s.serviceTempIds.filter((x) => x !== svcTempId)
        : [...s.serviceTempIds, svcTempId],
    })));
  }
  function setStaffHours(tempId: string, weekday: number, patch: Partial<DayHours>) {
    setStaff((all) => all.map((s) => s.tempId !== tempId ? s : ({
      ...s,
      hours: s.hours.map((h, i) => i === weekday ? { ...h, ...patch } : h),
    })));
  }

  function addManager() {
    const v = managerEmail.trim().toLowerCase();
    if (!v || !v.includes("@")) { toast.error("Enter a valid email"); return; }
    if (managers.includes(v)) { setManagerEmail(""); return; }
    setManagers([...managers, v]);
    setManagerEmail("");
  }

  function canAdvance(): boolean {
    if (step === 0) return info.name.trim().length > 0;
    if (step === 4) return services.length > 0;
    return true;
  }
  function next() {
    if (!canAdvance()) {
      if (step === 0) toast.error("Business name is required");
      if (step === 4) toast.error("Add at least one service");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  async function submit() {
    if (!user) return;
    setBusy(true);
    try {
      const payload = {
        business: {
          name: info.name,
          category: info.category || null,
          phone: info.phone || null,
          description: info.description || null,
          addressLine1: location.address_line1 || null,
          city: location.city || null,
          region: location.region || null,
          postalCode: location.postal_code || null,
          country: location.country || null,
          logoUrl: info.logoUrl || null,
        },
        hours: hours
          .map((h, weekday) => ({ ...h, weekday }))
          .filter((h) => !h.closed && h.close > h.open)
          .map((h) => ({ weekday: h.weekday, openMinute: h.open * 60, closeMinute: h.close * 60 })),
        categories: categories.map((c) => ({ tempId: c.tempId, name: c.name })),
        services: services.map((s) => ({
          tempId: s.tempId,
          name: s.name,
          durationMin: s.duration_min,
          price: s.price,
          description: s.description || null,
          categoryTempId: s.categoryTempId || null,
        })),
        staff: staff.map((st) => ({
          name: st.name,
          serviceTempIds: st.serviceTempIds,
          availabilities: st.hours
            .map((h, weekday) => ({ ...h, weekday }))
            .filter((h) => !h.closed && h.close > h.open)
            .map((h) => ({ weekday: h.weekday, startMinute: h.open * 60, endMinute: h.close * 60 })),
        })),
        managerEmails: managers,
      };
      const r = await createBizFn({ data: payload });
      toast.success("Business created");
      navigate({ to: "/admins/$adminId", params: { adminId: r.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create business");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="p-12 text-center">Loading…</div>;

  const totalSteps = STEPS.length;
  const progressPct = ((step + 1) / totalSteps) * 100;

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
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Step {step + 1} of {totalSteps}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{STEPS[step]}</h1>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <Label>Business image</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="size-20 rounded-md border bg-muted overflow-hidden grid place-items-center">
                      {info.logoUrl ? (
                        <img src={info.logoUrl} alt="" className="w-full h-full object-cover" />
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
                  <div>
                    <Label>Business name *</Label>
                    <Input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input value={info.category} onChange={(e) => setInfo({ ...info, category: e.target.value })} placeholder="Hair Salon, Auto Repair…" />
                  </div>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={3} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} placeholder="Tell customers what you offer." />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <Input placeholder="Address" value={location.address_line1} onChange={(e) => setLocation({ ...location, address_line1: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input placeholder="City" value={location.city} onChange={(e) => setLocation({ ...location, city: e.target.value })} />
                  <Input placeholder="Region/State" value={location.region} onChange={(e) => setLocation({ ...location, region: e.target.value })} />
                  <Input placeholder="Postal code" value={location.postal_code} onChange={(e) => setLocation({ ...location, postal_code: e.target.value })} />
                </div>
                <Input placeholder="Country" value={location.country} onChange={(e) => setLocation({ ...location, country: e.target.value })} />
                <p className="text-xs text-muted-foreground">All location fields are optional — you can fill these later.</p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Set when the business is open. Mark closed days with the toggle.</p>
                {WEEKDAYS.map((wd, i) => {
                  const h = hours[i];
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-12 text-muted-foreground">{wd}</span>
                      <Button
                        type="button" size="sm"
                        variant={h.closed ? "outline" : "default"}
                        className="w-20"
                        onClick={() => setHours((all) => all.map((x, idx) => idx === i ? { ...x, closed: !x.closed } : x))}
                      >
                        {h.closed ? "Closed" : "Open"}
                      </Button>
                      <Input
                        type="number" min={0} max={24} className="h-9 w-20"
                        disabled={h.closed}
                        value={h.open}
                        onChange={(e) => setHours((all) => all.map((x, idx) => idx === i ? { ...x, open: Number(e.target.value) } : x))}
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="number" min={0} max={24} className="h-9 w-20"
                        disabled={h.closed}
                        value={h.close}
                        onChange={(e) => setHours((all) => all.map((x, idx) => idx === i ? { ...x, close: Number(e.target.value) } : x))}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Add categories to group your services (optional but recommended).</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Haircuts, Color, Treatments"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                  />
                  <Button type="button" onClick={addCategory}><Plus /> Add</Button>
                </div>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <li key={c.tempId} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-sm">
                        {c.name}
                        <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeCategory(c.tempId)}>
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-4 md:grid-cols-[1fr_320px]">
                <div>
                  <p className="mb-2 text-sm font-medium">Your services ({services.length})</p>
                  {services.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No services yet — add one on the right.</p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {services.map((s) => {
                        const cat = categories.find((c) => c.tempId === s.categoryTempId);
                        return (
                          <li key={s.tempId} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{s.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {(cat?.name ?? "Uncategorized")} · {s.duration_min} min · ${Number(s.price).toFixed(0)}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" type="button" onClick={() => removeService(s.tempId)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Add a service</p>
                  <div><Label>Name</Label><Input value={svcDraft.name} onChange={(e) => setSvcDraft({ ...svcDraft, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Duration (min)</Label><Input type="number" value={svcDraft.duration_min} onChange={(e) => setSvcDraft({ ...svcDraft, duration_min: Number(e.target.value) })} /></div>
                    <div><Label>Price ($)</Label><Input type="number" value={svcDraft.price} onChange={(e) => setSvcDraft({ ...svcDraft, price: Number(e.target.value) })} /></div>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={svcDraft.categoryTempId || "__none__"} onValueChange={(v) => setSvcDraft({ ...svcDraft, categoryTempId: v === "__none__" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Uncategorized</SelectItem>
                        {categories.map((c) => <SelectItem key={c.tempId} value={c.tempId}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Description</Label><Textarea rows={2} value={svcDraft.description} onChange={(e) => setSvcDraft({ ...svcDraft, description: e.target.value })} /></div>
                  <Button type="button" onClick={addService} className="w-full"><Plus /> Add service</Button>
                </div>
              </div>
            )}

            {step === 5 && (
              <StaffStep
                staff={staff}
                services={services}
                editingStaffId={editingStaffId}
                setEditingStaffId={setEditingStaffId}
                staffDraftName={staffDraftName}
                setStaffDraftName={setStaffDraftName}
                addStaff={addStaff}
                removeStaff={removeStaff}
                toggleStaffService={toggleStaffService}
                setStaffHours={setStaffHours}
              />
            )}

            {step === 6 && (
              <ReviewStep
                info={info}
                location={location}
                hours={hours}
                categories={categories}
                services={services}
                staff={staff}
                managers={managers}
                managerEmail={managerEmail}
                setManagerEmail={setManagerEmail}
                addManager={addManager}
                removeManager={(m) => setManagers(managers.filter((x) => x !== m))}
              />
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || busy}>
            <ArrowLeft /> Back
          </Button>
          <div className="flex items-center gap-2">
            {step === 5 && (
              <Button type="button" variant="outline" onClick={() => setStep(6)} disabled={busy}>
                Skip staff
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={busy}>
                Next <ArrowRight />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={busy || uploading}>
                {busy && <Loader2 className="size-4 animate-spin" />} <Check /> Create business
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StaffStep(props: {
  staff: WizardStaff[];
  services: WizardService[];
  editingStaffId: string | null;
  setEditingStaffId: (id: string | null) => void;
  staffDraftName: string;
  setStaffDraftName: (s: string) => void;
  addStaff: () => void;
  removeStaff: (id: string) => void;
  toggleStaffService: (staffId: string, svcId: string) => void;
  setStaffHours: (staffId: string, weekday: number, patch: Partial<DayHours>) => void;
}) {
  const editing = useMemo(
    () => props.staff.find((s) => s.tempId === props.editingStaffId) ?? null,
    [props.staff, props.editingStaffId]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Staff are optional. You can also add them later from the dashboard.</p>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Staff name"
              value={props.staffDraftName}
              onChange={(e) => props.setStaffDraftName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); props.addStaff(); } }}
            />
            <Button type="button" onClick={props.addStaff}><Plus /></Button>
          </div>
          {props.staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff added.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {props.staff.map((s) => (
                <li key={s.tempId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => props.setEditingStaffId(s.tempId)}
                    className={`flex-1 text-left text-sm ${props.editingStaffId === s.tempId ? "font-semibold" : ""}`}
                  >
                    {s.name}
                  </button>
                  <Button variant="ghost" size="icon" type="button" onClick={() => props.removeStaff(s.tempId)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          {!editing ? (
            <p className="text-sm text-muted-foreground">Add a staff member to set their services and hours.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider">Services performed</Label>
                {props.services.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Add services on the previous step first.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {props.services.map((svc) => {
                      const on = editing.serviceTempIds.includes(svc.tempId);
                      return (
                        <Button
                          key={svc.tempId}
                          type="button"
                          size="sm"
                          variant={on ? "default" : "outline"}
                          onClick={() => props.toggleStaffService(editing.tempId, svc.tempId)}
                        >
                          {svc.name}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider">Weekly hours</Label>
                <div className="mt-2 space-y-1.5">
                  {WEEKDAYS.map((wd, i) => {
                    const h = editing.hours[i];
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-10 text-muted-foreground">{wd}</span>
                        <Button
                          type="button" size="sm"
                          variant={h.closed ? "outline" : "default"}
                          className="w-16"
                          onClick={() => props.setStaffHours(editing.tempId, i, { closed: !h.closed })}
                        >
                          {h.closed ? "Off" : "On"}
                        </Button>
                        <Input
                          type="number" min={0} max={24} className="h-8 w-16" disabled={h.closed}
                          value={h.open}
                          onChange={(e) => props.setStaffHours(editing.tempId, i, { open: Number(e.target.value) })}
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="number" min={0} max={24} className="h-8 w-16" disabled={h.closed}
                          value={h.close}
                          onChange={(e) => props.setStaffHours(editing.tempId, i, { close: Number(e.target.value) })}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewStep(props: {
  info: { name: string; category: string; description: string; phone: string; logoUrl: string };
  location: { address_line1: string; city: string; region: string; postal_code: string; country: string };
  hours: DayHours[];
  categories: WizardCategory[];
  services: WizardService[];
  staff: WizardStaff[];
  managers: string[];
  managerEmail: string;
  setManagerEmail: (s: string) => void;
  addManager: () => void;
  removeManager: (m: string) => void;
}) {
  const addr = [props.location.address_line1, props.location.city, props.location.region, props.location.postal_code, props.location.country]
    .filter(Boolean).join(", ");
  return (
    <div className="space-y-5">
      <Section title="Business">
        <p className="font-medium">{props.info.name || <em className="text-muted-foreground">No name</em>}</p>
        {props.info.category && <p className="text-sm text-muted-foreground">{props.info.category}</p>}
        {props.info.phone && <p className="text-sm text-muted-foreground">{props.info.phone}</p>}
        {props.info.description && <p className="text-sm">{props.info.description}</p>}
        {addr && <p className="text-sm text-muted-foreground">{addr}</p>}
      </Section>
      <Section title="Store hours">
        <ul className="text-sm">
          {WEEKDAYS.map((wd, i) => {
            const h = props.hours[i];
            return (
              <li key={i} className="flex gap-3">
                <span className="w-12 text-muted-foreground">{wd}</span>
                <span>{h.closed || h.close <= h.open ? "Closed" : `${h.open}:00 – ${h.close}:00`}</span>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title={`Categories (${props.categories.length})`}>
        {props.categories.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <p className="text-sm">{props.categories.map((c) => c.name).join(" · ")}</p>
        )}
      </Section>
      <Section title={`Services (${props.services.length})`}>
        {props.services.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="space-y-1 text-sm">
            {props.services.map((s) => {
              const cat = props.categories.find((c) => c.tempId === s.categoryTempId);
              return (
                <li key={s.tempId}>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground"> — {(cat?.name ?? "Uncategorized")} · {s.duration_min} min · ${Number(s.price).toFixed(0)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section title={`Staff (${props.staff.length})`}>
        {props.staff.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="space-y-1 text-sm">
            {props.staff.map((s) => (
              <li key={s.tempId}>
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground"> — {s.serviceTempIds.length} services</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Invite co-managers (optional)">
        <p className="text-xs text-muted-foreground mb-2">They'll become co-managers when they sign in with this email.</p>
        <div className="flex gap-2">
          <Input
            type="email" placeholder="provider@example.com"
            value={props.managerEmail}
            onChange={(e) => props.setManagerEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); props.addManager(); } }}
          />
          <Button type="button" variant="outline" onClick={props.addManager}><Plus /> Add</Button>
        </div>
        {props.managers.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {props.managers.map((m) => (
              <li key={m} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-sm">
                {m}
                <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => props.removeManager(m)}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
