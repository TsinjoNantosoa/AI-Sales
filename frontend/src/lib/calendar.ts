export function getGoogleCalendarUrl(appt: {
  title: string;
  date: string;
  time: string;
  duration: number;
  details?: string;
  location?: string;
}): string {
  const [h, m] = appt.time.split(":").map(Number);
  const start = new Date(`${appt.date}T00:00:00`);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + appt.duration * 60_000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", appt.title);
  url.searchParams.set("dates", `${fmt(start)}/${fmt(end)}`);
  if (appt.details) url.searchParams.set("details", appt.details);
  if (appt.location) url.searchParams.set("location", appt.location);
  return url.toString();
}
