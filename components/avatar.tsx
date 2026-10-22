// Round initials for a person (there are no profile photos).
import { initials } from "@/lib/names";

export { displayName } from "@/lib/names";

const BACKGROUNDS = ["bg-pastel-blue", "bg-pastel-lavender", "bg-emerald-100", "bg-orange-100", "bg-pink-100", "bg-amber-100"];

export function Avatar({ name, seed, className = "size-6 text-[10px]" }: { name: string; seed: string; className?: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink ${BACKGROUNDS[Math.abs(h) % BACKGROUNDS.length]} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
