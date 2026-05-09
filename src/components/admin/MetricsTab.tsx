import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getAdminMetrics } from "@/lib/admin.functions";

type Metrics = {
  window_days: number;
  top_services: { name: string; bookings: number }[];
  busy_dow: { dow: number; bookings: number }[];
  busy_hour: { hour: number; bookings: number }[];
  funnel: {
    total_lock_attempts: number;
    confirmed_bookings: number;
    abandoned_attempts: number;
    avg_time_to_complete_seconds: number;
  };
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtSeconds(s: number) {
  if (!s || s <= 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function MetricsTab({ businessId }: { businessId: string }) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchMetrics = useServerFn(getAdminMetrics);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMetrics({ data: { businessId, days } })
      .then((d) => { if (!cancelled) setData(d as Metrics); })
      .catch((e: any) => { if (!cancelled) setError(e?.message ?? "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [businessId, days, fetchMetrics]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading metrics…</div>;
  if (error) return <div className="py-12 text-center text-destructive">{error}</div>;
  if (!data) return null;

  const completionRate = data.funnel.total_lock_attempts > 0
    ? Math.round((data.funnel.confirmed_bookings / data.funnel.total_lock_attempts) * 100)
    : 0;

  const dowChart = DOW_LABELS.map((label, i) => ({
    label,
    bookings: data.busy_dow.find((d) => d.dow === i)?.bookings ?? 0,
  }));

  const hourChart = Array.from({ length: 24 }, (_, h) => ({
    label: `${h.toString().padStart(2, "0")}:00`,
    bookings: data.busy_hour.find((d) => d.hour === h)?.bookings ?? 0,
  }));

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Window:</span>
        {[7, 30, 90, 365].map((n) => (
          <Button key={n} size="sm" variant={days === n ? "default" : "outline"} onClick={() => setDays(n)}>
            {n === 365 ? "1 year" : `${n} days`}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={<CheckCircle2 className="size-4 text-emerald-500" />} label="Confirmed bookings" value={data.funnel.confirmed_bookings.toString()} />
        <KPI icon={<TrendingUp className="size-4 text-violet-500" />} label="Completion rate" value={`${completionRate}%`} sub={`${data.funnel.confirmed_bookings} / ${data.funnel.total_lock_attempts} attempts`} />
        <KPI icon={<AlertTriangle className="size-4 text-amber-500" />} label="Abandoned attempts" value={data.funnel.abandoned_attempts.toString()} sub="Slot held but never booked" />
        <KPI icon={<Clock className="size-4 text-sky-500" />} label="Avg. time to book" value={fmtSeconds(data.funnel.avg_time_to_complete_seconds)} sub="From slot pick → confirm" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most booked services</CardTitle>
          <CardDescription>Top services by confirmed bookings in the last {data.window_days} days.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.top_services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet in this window.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top_services} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={140} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Busiest days</CardTitle>
            <CardDescription>Bookings by day of week.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dowChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Busiest hours</CardTitle>
            <CardDescription>Bookings by hour of day (start time).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" interval={2} />
                  <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
