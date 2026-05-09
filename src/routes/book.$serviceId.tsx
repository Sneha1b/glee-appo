import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Loader2, Timer, X, CalendarClock } from "lucide-react";
import { computeSlots, findNextAvailableDay, acquireLock, releaseLock, confirmBooking, getSessionId, type Slot } from "@/lib/slots";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fmtTime, fmtDate, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/book/$serviceId")({
  component: BookPage,
  head: () => ({ meta: [{ title: "Book an appointment" }] }),
});

type Service = { id: string; name: string; duration_min: number; price: number; description: string | null };

function BookPage() {
  const { serviceId } = Route.useParams();
  const navigate = useNavigate();
  const { user, customerProfile } = useAuth();
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<Date | undefined>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ when: string; staff: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [searching, setSearching] = useState(false);
  const [autoJumpedFrom, setAutoJumpedFrom] = useState<Date | null>(null);
  const [noAvailWindow, setNoAvailWindow] = useState(false);
  const holderRef = useRef<string>("");
  const initialScanDoneRef = useRef(false);
  const skipNextFetchRef = useRef(false);

  if (!holderRef.current) holderRef.current = getSessionId();

  // Prefill form for logged-in customers
  useEffect(() => {
    if (user) {
      setForm({
        name: customerProfile?.full_name || "",
        email: user.email || "",
        phone: customerProfile?.phone || "",
      });
    }
  }, [user, customerProfile]);

  // Load service
  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .maybeSingle()
      .then(({ data }) => setService(data as Service | null));
  }, [serviceId]);

  // Initial scan: find the first day with availability within 15 days
  useEffect(() => {
    if (!service || initialScanDoneRef.current) return;
    initialScanDoneRef.current = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSearching(true);
    setLoadingSlots(true);
    findNextAvailableDay({
      serviceId: service.id,
      durationMin: service.duration_min,
      fromDate: today,
      horizonDays: 15,
    })
      .then((result) => {
        if (!result) {
          setNoAvailWindow(true);
          setSlots([]);
          return;
        }
        const isToday = result.date.getTime() === today.getTime();
        if (!isToday) {
          setAutoJumpedFrom(today);
          skipNextFetchRef.current = true;
          setDate(result.date);
        }
        setSlots(result.slots);
      })
      .catch((e) => toast.error(e.message ?? "Failed to load availability"))
      .finally(() => {
        setSearching(false);
        setLoadingSlots(false);
      });
  }, [service]);

  // Load slots when date changes (after initial scan / on user pick)
  useEffect(() => {
    if (!service || !date) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (!initialScanDoneRef.current) return;
    setLoadingSlots(true);
    setPicked(null);
    setLockExpiresAt(null);
    setAutoJumpedFrom(null);
    setNoAvailWindow(false);
    computeSlots({ serviceId: service.id, durationMin: service.duration_min, date })
      .then(setSlots)
      .catch((e) => toast.error(e.message ?? "Failed to load slots"))
      .finally(() => setLoadingSlots(false));
  }, [service, date]);

  // Tick for countdown
  useEffect(() => {
    if (!lockExpiresAt) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [lockExpiresAt]);

  // Auto-release on lock expiry
  useEffect(() => {
    if (!lockExpiresAt || !picked) return;
    if (now >= lockExpiresAt) {
      toast.error("Your hold expired. Please pick a slot again.");
      setPicked(null);
      setLockExpiresAt(null);
      // refresh slots
      if (service && date) {
        computeSlots({ serviceId: service.id, durationMin: service.duration_min, date }).then(setSlots);
      }
    }
  }, [now, lockExpiresAt, picked, service, date]);

  // Release lock if user navigates away or picks a different slot
  useEffect(() => {
    return () => {
      if (picked && lockExpiresAt && Date.now() < lockExpiresAt) {
        releaseLock(holderRef.current, picked.staffId, picked.startAt);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remainingMs = lockExpiresAt ? Math.max(0, lockExpiresAt - now) : 0;

  // Group slots by staff
  const byStaff = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      if (!m.has(s.staffId)) m.set(s.staffId, []);
      m.get(s.staffId)!.push(s);
    }
    return m;
  }, [slots]);

  async function pick(slot: Slot) {
    // release any prior lock first
    if (picked && lockExpiresAt && Date.now() < lockExpiresAt) {
      await releaseLock(holderRef.current, picked.staffId, picked.startAt);
    }
    try {
      const lock = await acquireLock({
        holder: holderRef.current,
        staffId: slot.staffId,
        serviceId: serviceId,
        startAt: slot.startAt,
        endAt: slot.endAt,
      });
      if (!lock) {
        toast.error("Someone else is holding this slot. Try another.");
        return;
      }
      setPicked(slot);
      setLockExpiresAt(new Date(lock.expires_at).getTime());
      setNow(Date.now());
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("already_booked") || msg.includes("slot_locked")) {
        toast.error("That slot was just taken. Please pick another.");
        if (service && date) {
          const fresh = await computeSlots({ serviceId: service.id, durationMin: service.duration_min, date });
          setSlots(fresh);
        }
      } else {
        toast.error(msg || "Could not hold the slot");
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || !service) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const booking = await confirmBooking({
        holder: holderRef.current,
        serviceId: service.id,
        staffId: picked.staffId,
        startAt: picked.startAt,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setLockExpiresAt(null);
      if (booking && (booking as any).id) {
        navigate({ to: "/pay/$bookingId", params: { bookingId: (booking as any).id } });
        return;
      }
      setConfirmed({ when: fmtDateTime(picked.startAt), staff: picked.staffName });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("lock_invalid")) {
        toast.error("Your hold expired. Please pick a slot again.");
        setPicked(null);
        setLockExpiresAt(null);
      } else {
        toast.error(msg || "Booking failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!service) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            ✓
          </div>
          <h1 className="text-2xl font-semibold">You're booked</h1>
          <p className="mt-2 text-muted-foreground">
            {service.name} with {confirmed.staff}
          </p>
          <p className="mt-1 font-medium">{confirmed.when}</p>
          <Button className="mt-8" onClick={() => navigate({ to: "/" })}>
            Back to services
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft /> Back
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Booking</p>
            <h1 className="font-semibold">{service.name}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {service.duration_min} min
            </span>
            <span className="font-semibold text-foreground">${Number(service.price).toFixed(0)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:grid-cols-[auto_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pick a date</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => {
                const t = new Date();
                t.setHours(0, 0, 0, 0);
                return d < t;
              }}
              className="pointer-events-auto p-0"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {autoJumpedFrom && (
            <Alert className="relative pr-10">
              <CalendarClock className="size-4" />
              <AlertDescription>
                No openings on {fmtDate(autoJumpedFrom)} — showing the next available day instead.
              </AlertDescription>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setAutoJumpedFrom(null)}
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{date ? fmtDate(date) : "Pick a date"}</CardTitle>
              <CardDescription>
                {searching
                  ? "Finding the next available day…"
                  : loadingSlots
                    ? "Loading availability…"
                    : `${slots.length} slot${slots.length === 1 ? "" : "s"} available`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {searching ? "Finding the next available day…" : "Loading…"}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {noAvailWindow
                    ? "No availability in the next 15 days. Try contacting the business directly."
                    : "No availability on this day. Try another date."}
                </p>
              ) : (
                <div className="space-y-4">
                  {[...byStaff.entries()].map(([sid, sl]) => (
                    <div key={sid}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {sl[0].staffName}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sl.map((s) => {
                          const isPicked =
                            picked?.staffId === s.staffId && picked.startAt === s.startAt;
                          return (
                            <Button
                              key={`${s.staffId}-${s.startAt}`}
                              size="sm"
                              variant={isPicked ? "default" : "outline"}
                              onClick={() => pick(s)}
                            >
                              {fmtTime(s.startAt)}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {picked && lockExpiresAt && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Confirm your booking</CardTitle>
                    <CardDescription>
                      {fmtDateTime(picked.startAt)} · {picked.staffName}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    <Timer className="size-3" /> {Math.ceil(remainingMs / 1000)}s
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={submit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="size-4 animate-spin" />}
                    Confirm booking
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
