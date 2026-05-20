import { useState, useEffect, useCallback } from "react";
import * as Calendar from "expo-calendar";
import { startOfDay, endOfDay, addDays, format, isToday, isTomorrow } from "date-fns";

export const dayLabel = (date) => {
  const d = new Date(date);
  if (isToday(d))    return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
};

const loadEvents = async (setEvents, setSources) => {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const active = (calendars ?? []).filter((c) => c.id);
    if (!active.length) return;
    const sourceNames = [...new Set(active.map((c) => c.source?.name).filter(Boolean))];
    setSources(sourceNames);
    const ids = active.map((c) => c.id);
    const now = new Date();
    const raw = await Calendar.getEventsAsync(ids, startOfDay(now), endOfDay(addDays(now, 6)));
    setEvents(
      (raw ?? [])
        .filter((e) => e.title)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    );
  } catch {
    // fail silently
  }
};

const safeLoad = (setEvents, setSources) =>
  loadEvents(setEvents, setSources).catch(() => {});

export const useCalendarEvents = (enabled = true) => {
  const [events, setEvents]   = useState([]);
  const [sources, setSources] = useState([]);
  const [status, setStatus]   = useState("loading");

  useEffect(() => {
    if (!enabled) { setStatus("undetermined"); return; }
    Calendar.getCalendarPermissionsAsync()
      .then(({ status: s }) => {
        setStatus(s);
        if (s === "granted") safeLoad(setEvents, setSources);
      })
      .catch(() => setStatus("undetermined"));
  }, [enabled]);

  const requestPermission = useCallback(async () => {
    try {
      const { status: s } = await Calendar.requestCalendarPermissionsAsync();
      setStatus(s);
      if (s === "granted") await safeLoad(setEvents, setSources);
    } catch {
      setStatus("denied");
    }
  }, []);

  return { events, sources, status, requestPermission };
};
