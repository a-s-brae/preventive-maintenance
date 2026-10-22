"use client";

import { useEffect, useState } from "react";
import { MINUTE, timeAgo } from "@/lib/time";

/** Relative time that the browser re-renders in its own time zone (the server's is UTC). */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState(() => timeAgo(new Date(iso), new Date(), "UTC"));
  useEffect(() => {
    const update = () => setText(timeAgo(new Date(iso), new Date()));
    update();
    const t = setInterval(update, MINUTE);
    return () => clearInterval(t);
  }, [iso]);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
