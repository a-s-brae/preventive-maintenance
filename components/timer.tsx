"use client";

import { useEffect, useState } from "react";

/** A running "1:07:32" clock from a start time. */
export function Timer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const hms = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60];
  return <span className="font-mono tabular-nums">{`${hms[0]}:${String(hms[1]).padStart(2, "0")}:${String(hms[2]).padStart(2, "0")}`}</span>;
}
