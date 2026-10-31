"use client";

import { useEffect, useRef, useState } from "react";

export type UpiInfo = {
  /** who receives the money (worker / supplier name) */
  payee?: string | null;
  /** saved UPI ID of the payee, if any */
  upiId?: string | null;
  /** amount in ₹; if not given it is read from the form's amount field when the button is tapped */
  amount?: number;
  /** short text shown in GPay, e.g. "Sand bill" */
  purpose?: string;
};

export const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;
const GPAY_ANDROID = "com.google.android.apps.nbu.paisa.user";

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** Amount from the surrounding form: AmountField's rupee value, else the plain "amount" box. */
function formAmount(el: HTMLElement | null) {
  const form = el?.closest("form");
  if (!form) return 0;
  const r = form.querySelector<HTMLInputElement>("[data-rupees]");
  if (r && Number(r.value) > 0) return Number(r.value);
  const a = form.elements.namedItem("amount") as HTMLInputElement | null;
  return Number(a?.value) || 0;
}

/**
 * Shown when "GPay / UPI" is picked. Two ways:
 *  - Pay now: opens Google Pay (or any UPI app) with the payee's UPI ID and amount filled in;
 *    on a laptop it shows a QR code to scan with the phone. Then come back and Save.
 *  - Already paid: just record it (optionally with the UPI ref no.).
 * Submits `upiId` (saved to the worker / supplier for next time) and `upiRef` (added to the note).
 */
export function UpiPay({ payee, upiId, amount, purpose }: UpiInfo) {
  const box = useRef<HTMLDivElement>(null);
  const [how, setHow] = useState<"NOW" | "DONE">(upiId ? "NOW" : "DONE");
  const [vpa, setVpa] = useState(upiId ?? "");
  const [qr, setQr] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [os, setOs] = useState<"android" | "ios" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    setOs(/android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "desktop");
  }, []);

  // a different payee was picked → start again with their saved UPI ID
  useEffect(() => {
    setVpa(upiId ?? "");
    setHow(upiId ? "NOW" : "DONE");
    setQr(null);
    setOpened(false);
  }, [payee, upiId]);

  const valid = UPI_RE.test(vpa.trim());

  const query = () => {
    const amt = amount && amount > 0 ? amount : formAmount(box.current);
    const q = new URLSearchParams({ pa: vpa.trim(), pn: payee || vpa.trim(), cu: "INR" });
    if (amt > 0) q.set("am", amt.toFixed(2));
    const tn = [purpose, payee].filter(Boolean).join(" - ").slice(0, 50);
    if (tn) q.set("tn", tn);
    return { q: q.toString().replace(/\+/g, "%20"), amt };
  };

  const open = (app: "gpay" | "any") => {
    const { q } = query();
    let url = `upi://pay?${q}`;
    if (app === "gpay" && os === "android") url = `intent://pay?${q}#Intent;scheme=upi;package=${GPAY_ANDROID};end`;
    if (app === "gpay" && os === "ios") url = `gpay://upi/pay?${q}`;
    setOpened(true);
    window.location.href = url;
  };

  const showQr = async () => {
    const { q } = query();
    const QR = await import("qrcode");
    setQr(await QR.toDataURL(`upi://pay?${q}`, { margin: 1, width: 220 }));
  };

  const amtNow = amount && amount > 0 ? amount : 0;

  return (
    <div ref={box} className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="UPI payment">
        {(
          [
            ["NOW", "Pay now in GPay"],
            ["DONE", "Already paid"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={how === v}
            onClick={() => setHow(v)}
            className={`min-h-11 rounded-lg border px-3 text-sm font-medium sm:min-h-9 ${
              how === v ? "border-emerald-700 bg-emerald-700 text-white" : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {how === "NOW" && (
        <>
          <label className="block">
            <span className="label">{payee ? `${payee}'s UPI ID` : "UPI ID"}</span>
            <input
              name="upiId"
              value={vpa}
              onChange={(e) => {
                setVpa(e.target.value);
                setQr(null);
              }}
              placeholder="e.g. 98765xxxxx@ybl"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="input min-h-11 sm:min-h-0"
            />
            {vpa && !valid && <span className="mt-1 block text-xs text-rose-600">Looks wrong – a UPI ID is like name@bank</span>}
            {valid && payee && vpa.trim() !== (upiId ?? "") && <span className="mt-1 block text-xs text-stone-500">Will be saved for {payee} when you save this payment.</span>}
          </label>

          {valid && (
            <div className="flex flex-wrap gap-2">
              {os !== "desktop" ? (
                <>
                  <button type="button" onClick={() => open("gpay")} className="btn-primary min-h-11 bg-emerald-700 hover:bg-emerald-800">
                    Open Google Pay{amtNow ? ` · ${fmt(amtNow)}` : ""}
                  </button>
                  <button type="button" onClick={() => open("any")} className="btn-ghost min-h-11">
                    Other UPI app
                  </button>
                </>
              ) : (
                <button type="button" onClick={showQr} className="btn-primary bg-emerald-700 hover:bg-emerald-800">
                  Show QR to scan with phone
                </button>
              )}
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(vpa.trim())}
                className="btn-ghost min-h-11 sm:min-h-0"
              >
                Copy UPI ID
              </button>
            </div>
          )}

          {qr && (
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="UPI QR code" width={160} height={160} className="rounded border border-stone-200 bg-white" />
              <p className="max-w-xs text-xs text-stone-600">Open Google Pay on your phone → Scan QR. Amount and UPI ID are filled in. After paying, save here.</p>
            </div>
          )}

          {(opened || qr) && (
            <p className="rounded bg-white px-2 py-1.5 text-xs text-stone-700">
              Paid in Google Pay? Check it went through, then tap <b>Save</b> below. This app can&apos;t see your bank, so it only records it when you save.
            </p>
          )}
        </>
      )}

      <label className="block">
        <span className="label">UPI ref / UTR no. (optional)</span>
        <input name="upiRef" inputMode="numeric" placeholder="12-digit number from the GPay receipt" className="input min-h-11 sm:min-h-0" />
      </label>
    </div>
  );
}
