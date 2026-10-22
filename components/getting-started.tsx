// The dashboard's getting-started card, by role: an admin's setup checklist
// (ticked off from what's in the system), how to do a work order for
// technicians, and how reporting works for everyone else. Each can be hidden,
// and comes back from the Help page or with a new role.
import Link from "next/link";
import { setGuideHidden } from "@/lib/actions";
import { setupProgress, type SetupStep } from "@/lib/onboarding";
import { Icon } from "./icons";
import { REQUEST_STEPS, Steps, WORK_ORDER_STEPS } from "./work-flow";

function Hide({ label }: { label: string }) {
  return (
    <form action={setGuideHidden.bind(null, true)}>
      <button type="submit" className="text-xs whitespace-nowrap text-neutral-500 hover:text-ink">
        {label}
      </button>
    </form>
  );
}

const helpLink = (
  <Link href="/help" className="font-medium text-ink underline-offset-2 hover:underline">
    Help guide
  </Link>
);

/** An admin's steps to get a new system going. */
export function SetupCard({ steps }: { steps: SetupStep[] }) {
  const p = setupProgress(steps);
  return (
    <section data-tour="setup" aria-labelledby="setup-title" className="mb-6 rounded-2xl bg-surface p-5 sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="setup-title" className="text-sm font-semibold text-ink">
            {p.complete ? "You're all set up" : "Set up PM System"}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {p.complete
              ? "PM work orders now come up by themselves. Keep an eye on Needs attention."
              : `${p.done} of ${p.total} done — these tick off by themselves as you go.`}
          </p>
        </div>
        <Hide label={p.complete ? "Hide" : "Hide for now"} />
      </div>
      <div
        className="mb-2 h-1.5 overflow-hidden rounded-full bg-accent-100"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={p.total}
        aria-valuenow={p.done}
      >
        <div className="h-full rounded-full bg-accent-500 transition-[width]" style={{ width: `${(p.done / Math.max(1, p.total)) * 100}%` }} />
      </div>
      <ol className="divide-y divide-neutral-200/70">
        {steps.map((s, n) => (
          <li key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            {s.done ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <Icon name="check" className="size-3.5" />
                <span className="sr-only">Done:</span>
              </span>
            ) : (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs text-neutral-500 ring-1 ring-neutral-300 ring-inset">
                {n + 1}
              </span>
            )}
            <div className="min-w-0 flex-1 basis-56">
              <div className={`text-sm ${s.done ? "text-neutral-500" : "font-medium text-ink"}`}>
                {s.title}
                {s.optional && !s.done && <span className="ml-1.5 text-xs font-normal text-neutral-500">optional</span>}
              </div>
              {!s.done && <p className="text-sm text-neutral-600">{s.text}</p>}
            </div>
            {!s.done && (
              <Link href={s.href} className="btn-secondary h-8 shrink-0 px-3">
                {s.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 flex items-start gap-2 text-xs text-neutral-600">
        <Icon name="qr" className="mt-px size-4 text-neutral-500" />
        <span>
          Then print QR labels for your machines (Equipment → More → Print QR labels): anyone can scan one with their phone to report a problem.
          The {helpLink} explains the rest.
        </span>
      </p>
    </section>
  );
}

/** For technicians: the one thing they do most, in four steps. */
export function WorkOrderGuide() {
  return (
    <section aria-labelledby="guide-title" className="mb-6 rounded-2xl bg-pastel-blue p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="guide-title" className="text-sm font-semibold text-ink">
            How to do a work order
          </h2>
          <p className="mt-0.5 text-xs text-neutral-600">The {helpLink} covers everything else.</p>
        </div>
        <Hide label="Got it" />
      </div>
      <Steps steps={WORK_ORDER_STEPS} />
    </section>
  );
}

/** For requesters: what happens after they report a problem. */
export function RequestGuide() {
  return (
    <section aria-labelledby="guide-title" className="mb-6 rounded-2xl bg-pastel-blue p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="guide-title" className="text-sm font-semibold text-ink">
            How reporting works
          </h2>
          <p className="mt-0.5 text-xs text-neutral-600">
            Tip: scan the QR code on a machine with your phone camera to report a problem with it. More in the {helpLink}.
          </p>
        </div>
        <Hide label="Got it" />
      </div>
      <Steps steps={REQUEST_STEPS} />
    </section>
  );
}
