// Thin outline icons (24×24 grid, stroked), shared by the shell and pages.
const PATHS = {
  home: "M3.5 10.5 12 3.5l8.5 7V20a.5.5 0 0 1-.5.5h-5v-6h-6v6H4a.5.5 0 0 1-.5-.5z",
  clipboard: "M9 4h6m-6 0a2 2 0 0 0-2 2H5v15h14V6h-2a2 2 0 0 0-2-2M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M8 12h8M8 16h5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-7 9a7 7 0 0 1 14 0",
  calendar: "M4 6h16v15H4zm0 4h16M8 3v4m8-4v4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m0-13v5l3 2",
  repeat: "M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5m5 3a8 8 0 0 1-13.7 5.6L4 15m0 5v-5h5",
  cube: "m12 3 8 4.5v9L12 21l-8-4.5v-9zm0 0v18m8-13.5-8 4.5-8-4.5",
  inbox: "M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
  pin: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12m0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  alert: "M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
  box: "M21 8 12 3 3 8m18 0v8l-9 5m9-13-9 5m0 8-9-5V8m9 13v-8M3 8l9 5",
  users: "M16 19a4 4 0 0 0-8 0m4-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6m6 7a3 3 0 0 0-2-2.8M17 6.2a3 3 0 0 1 0 5.6M4 19a3 3 0 0 1 2-2.8M7 6.2a3 3 0 0 0 0 5.6",
  chart: "M4 20h16M7 16v-5m5 5V7m5 9v-8",
  pie: "M12 3a9 9 0 1 0 9 9h-9zm3-1v7h7a7 7 0 0 0-7-7",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zm4 4a2 2 0 0 0 4 0",
  wrench: "M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2zm0 0L17 4l3 3-2.5 2.5",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14m9 2-4-4",
  plus: "M12 5v14M5 12h14",
  star: "m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z",
  chevronRight: "m9.5 6.5 5.5 5.5-5.5 5.5",
  chevronDown: "m6.5 9.5 5.5 5.5 5.5-5.5",
  panelLeft: "M5 4.5h14a.5.5 0 0 1 .5.5v14a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5m4.5 0v15",
  panelRight: "M5 4.5h14a.5.5 0 0 1 .5.5v14a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5m9.5 0v15",
  logout: "M14 4.5h4.5a.5.5 0 0 1 .5.5v14a.5.5 0 0 1-.5.5H14M10 8l-4 4 4 4m-4-4h10",
  check: "m5 12.5 4.5 4.5L19 7.5",
  down: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m-2.6-11.6a2.6 2.6 0 1 1 3.7 2.4c-.6.3-1.1.8-1.1 1.5v.6m0 3.1h.01",
  arrowRight: "M5 12h14m-5-5 5 5-5 5",
  arrowDown: "M12 5v14m-5-5 5 5 5-5",
  play: "M8 5.5v13l10.5-6.5z",
  qr: "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16m0-12v4l2.5 2.5M10 2h4",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5", filled = false }: { name: IconName; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
