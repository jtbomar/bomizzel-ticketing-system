import { useCallback, useRef, useState } from 'react';
import { apiService } from '../services/api';

/**
 * Before an agent is added (or switched back on) on a paid plan: what it
 * costs, and when it's charged - on the next invoice for a monthly plan,
 * straight away for a yearly one. Trials, Free and plans given free cost
 * nothing more, so they go straight through.
 *
 *   const { confirmSeat, seatDialog } = useSeatConfirm();
 *   if (!(await confirmSeat())) return;
 *   ...render {seatDialog}
 */
interface Preview {
  applies: boolean;
  plan: string;
  interval: 'month' | 'year';
  perAgent: number;
  seats: number;
  seatsAfter: number;
  prorationAmount: number;
  chargedNow: boolean;
  nextInvoiceDate: string | null;
}

const money = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'your next bill';

export const useSeatConfirm = () => {
  const [preview, setPreview] = useState<Preview | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirmSeat = useCallback(async (): Promise<boolean> => {
    let p: Preview;
    try {
      p = await apiService.seatPreview(1);
    } catch {
      return true; // can't tell: the server still applies the plan's rules
    }
    if (!p?.applies) return true;
    setPreview(p);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (ok: boolean) => {
    setPreview(null);
    resolver.current?.(ok);
    resolver.current = null;
  };

  // Above the add-agent form it's opened from (that's z-50 too, and later on the page)
  const per = preview?.interval === 'year' ? 'a year' : 'a month';
  const seatDialog = preview ? (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
      onClick={() => answer(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seat-title"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && answer(false)}
      >
        <h2 id="seat-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          Add an agent to your plan?
        </h2>
        <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p>
            {preview.plan}, billed {preview.interval === 'year' ? 'yearly' : 'monthly'}:{' '}
            {money(preview.perAgent)} {per} for each agent.
          </p>
          <p>
            You'll have <strong>{preview.seatsAfter} agents</strong>:{' '}
            {money(preview.perAgent * preview.seatsAfter)} {per}
            {preview.interval === 'year' ? ' from your next renewal' : ''}.
          </p>
          <p className="rounded-md bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
            {preview.chargedNow ? (
              <>
                <strong>{money(preview.prorationAmount)} is charged now</strong> to your card, for
                the rest of this billing year.
              </>
            ) : (
              <>
                About <strong>{money(preview.prorationAmount)}</strong> for the rest of this month
                is added to your next invoice ({day(preview.nextInvoiceDate)}).
              </>
            )}
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => answer(false)}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:underline"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => answer(true)}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            {preview.chargedNow
              ? `Add agent and pay ${money(preview.prorationAmount)}`
              : 'Add agent'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmSeat, seatDialog };
};
