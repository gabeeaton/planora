// ============================================================
// src/hooks/useCalendarEvents.js
// Reads today's Apple Calendar events via expo-calendar.
// Requests permission once, then returns events sorted by start time.
// Returns [] on denial or simulator — never throws.
// ============================================================

import { useState, useEffect } from "react";
import * as Calendar from "expo-calendar";
import { startOfDay, endOfDay } from "date-fns";

export const useCalendarEvents = (enabled = true) => {
  const [events, setEvents]       = useState([]);
  const [permission, setPermission] = useState(null); // "granted" | "denied" | null

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const load = async () => {
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (cancelled) return;
        setPermission(status);
        if (status !== "granted") return;

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        if (cancelled) return;

        const calendarIds = calendars.map((c) => c.id);
        const now   = new Date();
        const start = startOfDay(now);
        const end   = endOfDay(now);

        const raw = await Calendar.getEventsAsync(calendarIds, start, end);
        if (cancelled) return;

        const today = raw
          .filter((e) => !e.allDay || e.title) // skip unnamed all-day events
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        setEvents(today);
      } catch {
        // Calendar unavailable (simulator, denied, etc.) — fail silently
      }
    };

    load();
    return () => { cancelled = true; };
  }, [enabled]);

  return { events, permission };
};
