import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getServiceForBooking } from "@/lib/businesses.functions";
import {
  getDayAvailability,
  acquireLockFn,
  releaseLockFn,
  confirmBookingFn,
} from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Loader2, Timer, X, CalendarClock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fmtTime, fmtDate, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/book/$serviceId")({
  component: BookPage,
  head: () => ({ meta: [{ title: "Book an appointment" }] }),
});

type Slot = { staffId: string; staffName: string; startAt: string; endAt: string };

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let v = window.sessionStorage.getItem("booking_holder");
  if (!v) {
    v = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem("booking_holder", v);
  }
  return v;
}

function mapErr(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("slot_in_past")) return "That time has already passed. Please pick another slot.";
  if (m.includes("already_booked")) return "That slot was just booked by someone else.";
  if (m.includes("slot_locked")) return "Someone else is currently booking that slot.";
  if (m.includes("lock_invalid")) return "Your hold expired. Please pick the slot again.";
  return msg || "Something went wrong.";
}

function BookPage() {
  const { serviceId } = Route.useParams();
  const navigate = useNavigate();
  const { user, customerProfile } = useAuth();
  const callGetService = useServerFn(getServiceForBooking);
  const callAvailability = useServerFn(getDayAvailability);
  const callAcquire = useServerFn(acquireLockFn);
  const callRelease = useServerFn(releaseLockFn);
  const callConfirm = useServerFn(confirmBookingFn);

  const [service, setService] = useState<Awaited<ReturnType<typeof getServiceForBooking>> | null>(null);
  const [date, setDate] = useState<Date | undefined>(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0); return t;
  });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [searching, setSearching] = useState(false);
  const [autoJumpedFrom, setAutoJumpedFrom] = useState<Date | null>(null);
  const [noAvailWindow, setNoAvailWindow] = useState(false);
  const holderRef = useRef<string>("");
  const initialScanDoneRef = useRef(false);
  const skipNextFetchRef = useRef(false);

  if (!holderRef.current) holderRef.current = getSessionId();

  useEffect(() => {
    if (user) {
      setForm({
        name: customerProfile?.full_name || "",
        email: user.email || "",
        phone: customerProfile?.phone || "",
      });
    }
  }, [user, customerProfile]);

  useEffect(() => {
    callGetService({ data: { serviceId } }).then((s) => setService(s));
  }, [serviceId, callGetService]);

  // Initial scan: try today, then up to 15 days
  useEffect(() => {
    if (!service || initialScanDoneRef.current) return;
    initialScanDoneRef.current = true;
    setSearching(true);
    setLoadingSlots(true);
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (let i = 0; i < 15; i++) {
        const d = new Date(today); d.setDate(d.getDate() + i);
        try {
          const result = await callAvailability({
            data: { serviceId: service.id, date: d.toISOString() },
          });
          if (result.length > 0) {
            if (i > 0) {
              setAutoJumpedFrom(today);
              skipNextFetchRef.current = true;
              setDate(d);
            }
            setSlots(result);
            return;
          }
        } catch (e) { console.warn(e); }
      }
      setNoAvailWindow(true);
      setSlots([]);
    })().finally(() => { setSearching(false); setLoadingSlots(false); });
  }, [service, callAvailability]);

  useEffect(() => {
    if (!service || !date) return;
    if (skipNextFetchRef.current) { skipNextFetchRef.current = false; return; }
    if (!initialScanDoneRef.current) return;
    setLoadingSlots(true);
    setPicked(null);
    setLockExpiresAt(null);
    setAutoJumpedFrom(null);
    setNoAvailWindow(false);
    callAvailability({ data: { serviceId: service.id, date: date.toISOString() } })
      .then(setSlots)
      .catch((e) => toast.error(mapErr(e?.message)))
      .finally(() => setLoadingSlots(false));
  }, [service, date, callAvailability]);

  useEffect(() => {
    if (!lockExpiresAt) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [lockExpiresAt]);

  useEffect(() => {
    if (!lockExpiresAt || !picked) return;
    if (now >= lockExpiresAt) {
      toast.error("Your hold expired. Please pick a slot again.");
      setPicked(null);
      setLockExpiresAt(null);
      if (service && date) {
        callAvailability({ data: { serviceId: service.id, date: date.toISOString() } }).then(setSlots);
      }
    }
  }, [now, lockExpiresAt, picked, service, date, callAvailability]);

  useEffect(() => {
    return () => {
      if (picked && lockExpiresAt && Date.now() < lockExpiresAt) {
        callRelease({
          data: { holderSessionId: holderRef.current, staffId: picked.staffId, startAt: picked.startAt },
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remainingMs = lockExpiresAt ? Math.max(0, lockExpiresAt - now) : 0;

  const byStaff = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      if (!m.has(s.staffId)) m.set(s.staffId, []);
      m.get(s.staffId)!.push(s);
    }
    return m;
  }, [slots]);

  async function pick(slot: Slot) {
    if (picked && lockExpiresAt && Date.now() < lockExpiresAt) {
      await callRelease({
        data: { holderSessionId: holderRef.current, staffId: picked.staffId, startAt: picked.startAt },
      }).catch(() => {});
    }
    try {
      const lock = await callAcquire({
        data: {
          holderSessionId: holderRef.current,
          staffId: slot.staffId,
          serviceId,
          startAt: slot.startAt,
          endAt: slot.endAt,
        },
      });
      setPicked(slot);
      setLockExpiresAt(new Date(lock.expires_at).getTime());
      setNow(Date.now());
    } catch (e: any) {
      const msg = e?.message ?? "";
      toast.error(mapErr(msg));
      if (msg.includes("already_booked") || msg.includes("slot_locked")) {
        if (service && date) {
          const fresh = await callAvailability({
            data: { serviceId: service.id, date: date.toISOString() },
          });
          setSlots(fresh);
        }
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
      const booking = await callConfirm({
        data: {
          holderSessionId: holderRef.current,
          serviceId: service.id,
          staffId: picked.staffId,
          startAt: picked.startAt,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
        },
      });
      setLockExpiresAt(null);
      navigate({ to: "/pay/$bookingId", params: { bookingId: booking.id } });
    } catch (e: any) {
      const msg = e?.message ?? "";
      toast.error(mapErr(msg));
      if (msg.includes("lock_invalid")) { setPicked(null); setLockExpiresAt(null); }
    } finally {
      setSubmitting(false);
    }
  }

  if (!service) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft /> Back</Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Booking</p>
            <h1 className="font-semibold">{service.name}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> {service.duration_min} min</span>
            <span className="font-semibold text-foreground">${Number(service.price).toFixed(0)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:grid-cols-[auto_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-sm">Pick a date</CardTitle></CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => { const t = new Date(); t.setHours(0, 0, 0, 0); return d < t; }}
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
              <button type="button" aria-label="Dismiss" onClick={() => setAutoJumpedFrom(null)}
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="size-3.5" />
              </button>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{date ? fmtDate(date) : "Pick a date"}</CardTitle>
              <CardDescription>
                {searching ? "Finding the next available day…"
                  : loadingSlots ? "Loading availability…"
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
                          const isPicked = picked?.staffId === s.staffId && picked.startAt === s.startAt;
                          return (
                            <Button key={`${s.staffId}-${s.startAt}`} size="sm"
                              variant={isPicked ? "default" : "outline"} onClick={() => pick(s)}>
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
                    <CardDescription>{fmtDateTime(picked.startAt)} · {picked.staffName}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    <Timer className="size-3" /> {Math.ceil(remainingMs / 1000)}s
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={submit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label htmlFor="name">Name</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                    <div><Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                  </div>
                  <div><Label htmlFor="phone">Phone (optional)</Label>
                    <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="size-4 animate-spin" />} Confirm booking
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
