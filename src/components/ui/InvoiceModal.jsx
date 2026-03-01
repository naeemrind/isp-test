// src/components/ui/InvoiceModal.jsx
import { useRef } from "react";
import { toPng } from "html-to-image";
import {
  X,
  Printer,
  Wifi,
  CheckCircle2,
  AlertCircle,
  CornerDownRight,
  ImageDown,
  Tag,
  Package,
} from "lucide-react";
import { formatDate } from "../../utils/dateUtils";

function invoiceNumber(cycle) {
  const year = cycle.cycleStartDate?.slice(0, 4) || new Date().getFullYear();
  const seq = String(cycle.id).padStart(4, "0");
  return `INV-${year}-${seq}`;
}

function getScenario(cycle) {
  if (!cycle.isRenewal) return "new";
  if (Number(cycle.previousBalance) > 0) return "renewal_with_dues";
  return "renewal_clean";
}

const SCENARIO_LABELS = {
  new: {
    label: "New Connection",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  renewal_with_dues: {
    label: "Renewal — Previous Balance Included",
    color: "#c2410c",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
  renewal_clean: {
    label: "Renewal",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
};

// ── Build printable HTML ──────────────────────────────────────────────────────
function buildInvoiceHTML({
  invNo,
  scenarioMeta,
  customer,
  cycle,
  packageName,
  originalPackagePrice,
  discountAmt,
  discountLabel,
  materialTotal,
  materialItems,
  previousBalance,
  totalAmount,
  amountPaid,
  amountPending,
  installments,
}) {
  const hasDiscount = discountAmt > 0;
  const hasMaterial = materialTotal > 0;
  const hasPrevBalance = previousBalance > 0;

  const discountRow = hasDiscount
    ? `
    <tr>
      <td style="padding:5px 0; color:#15803d; font-size:13px;">
        🏷 Discount${discountLabel ? ` (${discountLabel})` : ""}
      </td>
      <td style="padding:5px 0; text-align:right; font-weight:600; color:#15803d; font-size:13px;">
        − PKR ${discountAmt.toLocaleString()}
      </td>
    </tr>`
    : "";

  const materialRows = hasMaterial
    ? `
    <tr>
      <td style="padding:5px 0; color:#92400e; font-size:13px;">📦 Material / Equipment</td>
      <td style="padding:5px 0; text-align:right; font-weight:600; color:#92400e; font-size:13px;">
        + PKR ${materialTotal.toLocaleString()}
      </td>
    </tr>
    ${(materialItems || [])
      .map(
        (it) => `
    <tr>
      <td style="padding:2px 0 2px 16px; color:#9ca3af; font-size:11px;">
        ${it.description} × ${it.qty} ${it.unit}
      </td>
      <td style="padding:2px 0; text-align:right; color:#9ca3af; font-size:11px;">
        PKR ${it.totalValue.toLocaleString()}
      </td>
    </tr>`,
      )
      .join("")}`
    : "";

  const prevBalanceRow = hasPrevBalance
    ? `
    <tr>
      <td style="padding:5px 0; color:#c2410c; font-size:13px;">↩ Previous unpaid balance</td>
      <td style="padding:5px 0; text-align:right; font-weight:600; color:#c2410c; font-size:13px;">
        + PKR ${previousBalance.toLocaleString()}
      </td>
    </tr>`
    : "";

  const installmentRows = installments
    .map(
      (inst) => `
    <tr>
      <td style="padding:6px 0; color:#374151; font-size:13px;">
        ${formatDate(inst.datePaid)}${inst.note ? ` · <span style="color:#9ca3af">${inst.note}</span>` : ""}
      </td>
      <td style="padding:6px 0; text-align:right; font-weight:600; color:#15803d; font-size:13px;">
        PKR ${Number(inst.amountPaid).toLocaleString()}
      </td>
    </tr>`,
    )
    .join("");

  const installmentsSection =
    installments.length > 0
      ? `
    <div style="border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:16px;">
      <div style="background:#f9fafb; padding:8px 16px; border-bottom:1px solid #e5e7eb;">
        <p style="margin:0; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9ca3af;">Payments Received</p>
      </div>
      <div style="padding:10px 16px;">
        <table style="width:100%; border-collapse:collapse;">
          ${installmentRows}
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding-top:8px; font-weight:600; color:#374151; font-size:13px;">Total Paid</td>
            <td style="padding-top:8px; text-align:right; font-weight:700; color:#15803d; font-size:13px;">PKR ${amountPaid.toLocaleString()}</td>
          </tr>
        </table>
      </div>
    </div>`
      : "";

  const shiftedAmount = Number(cycle.shiftedAmount || 0);
  const isCarriedForward = shiftedAmount > 0;
  const isPaid = amountPending === 0 && !isCarriedForward;

  const statusBar = isCarriedForward
    ? `
    <div style="display:flex;align-items:center;justify-content:space-between;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;">
      <div>
        <p style="margin:0;font-weight:700;color:#9a3412;font-size:14px;">Unpaid — Carried Forward</p>
        <p style="margin:2px 0 0;color:#c2410c;font-size:12px;">PKR ${shiftedAmount.toLocaleString()} moved to next cycle.</p>
      </div>
      <p style="margin:0;font-weight:900;color:#c2410c;font-size:20px;">PKR ${shiftedAmount.toLocaleString()}</p>
    </div>`
    : isPaid
      ? `
    <div style="display:flex;align-items:center;gap:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;">
      <div style="font-size:20px;">✅</div>
      <div>
        <p style="margin:0;font-weight:700;color:#166534;font-size:14px;">Paid in Full</p>
        <p style="margin:2px 0 0;color:#16a34a;font-size:12px;">No outstanding balance. Thank you!</p>
      </div>
    </div>`
      : `
    <div style="display:flex;align-items:center;justify-content:space-between;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;">
      <div>
        <p style="margin:0;font-weight:700;color:#991b1b;font-size:14px;">Balance Due</p>
        <p style="margin:2px 0 0;color:#dc2626;font-size:12px;">Please pay at your earliest convenience.</p>
      </div>
      <p style="margin:0;font-weight:900;color:#b91c1c;font-size:20px;">PKR ${amountPending.toLocaleString()}</p>
    </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Invoice ${invNo}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;background:#fff;padding:24px;font-size:14px;}@page{margin:12mm;}</style>
</head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #1f2937;margin-bottom:20px;">
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:22px;">📡</span>
        <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;">Galaxy ISP</span>
      </div>
      <p style="color:#6b7280;font-size:12px;">Internet Service Provider</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:2px;">Invoice</p>
      <p style="font-size:17px;font-weight:900;">${invNo}</p>
      <p style="font-size:12px;color:#6b7280;margin-top:2px;">Issued: ${formatDate(cycle.cycleStartDate)}</p>
    </div>
  </div>

  <div style="display:inline-flex;align-items:center;gap:6px;background:${scenarioMeta.bg};border:1px solid ${scenarioMeta.border};border-radius:8px;padding:6px 12px;margin-bottom:20px;">
    <span style="font-size:11px;font-weight:700;color:${scenarioMeta.color};">${scenarioMeta.label}</span>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-bottom:12px;">
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:3px;">Subscriber</p>
        <p style="font-size:15px;font-weight:700;color:#111827;">${customer.fullName}</p>
        <p style="font-size:12px;color:#6b7280;">${customer.userName}</p>
      </td>
      <td style="width:50%;vertical-align:top;padding-bottom:12px;">
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:3px;">Contact</p>
        <p style="font-size:13px;color:#374151;">${customer.mobileNo || "—"}</p>
        <p style="font-size:12px;color:#6b7280;">${customer.mainArea || "—"}</p>
      </td>
    </tr>
    <tr>
      <td style="vertical-align:top;">
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:3px;">Package</p>
        <p style="font-size:13px;font-weight:600;color:#374151;">${packageName || "—"}</p>
      </td>
      <td style="vertical-align:top;">
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:3px;">Billing Period</p>
        <p style="font-size:13px;color:#374151;">${formatDate(cycle.cycleStartDate)} → ${formatDate(cycle.cycleEndDate)}</p>
      </td>
    </tr>
  </table>

  <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:16px;">
    <div style="background:#f9fafb;padding:8px 16px;border-bottom:1px solid #e5e7eb;">
      <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;">Billing Breakdown</p>
    </div>
    <div style="padding:10px 16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:5px 0;color:#4b5563;font-size:13px;">Package charge (${packageName})</td>
          <td style="padding:5px 0;text-align:right;font-weight:600;color:#1f2937;font-size:13px;">PKR ${originalPackagePrice.toLocaleString()}</td>
        </tr>
        ${discountRow}
        ${materialRows}
        ${prevBalanceRow}
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding-top:10px;font-weight:700;color:#1f2937;font-size:14px;">Total Due</td>
          <td style="padding-top:10px;text-align:right;font-weight:900;color:#111827;font-size:16px;">PKR ${totalAmount.toLocaleString()}</td>
        </tr>
      </table>
    </div>
  </div>

  ${installmentsSection}
  ${statusBar}

  <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="font-size:10px;color:#9ca3af;">Galaxy ISP · Thank you for your business</p>
    <p style="font-size:10px;color:#d1d5db;margin-top:3px;">Computer-generated invoice — no signature required.</p>
  </div>
</body></html>`;
}

function printInvoice(htmlString) {
  const tab = window.open("", "_blank");
  if (!tab) {
    alert("Please allow pop-ups for this site to enable printing.");
    return;
  }
  tab.document.open();
  tab.document.write(htmlString);
  tab.document.close();
  tab.onload = () => {
    tab.focus();
    tab.print();
    tab.onafterprint = () => tab.close();
  };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InvoiceModal({
  isOpen,
  onClose,
  customer,
  cycle,
  packageName,
}) {
  const invoiceRef = useRef(null);

  if (!isOpen || !customer || !cycle) return null;

  const scenario = getScenario(cycle);
  const scenarioMeta = SCENARIO_LABELS[scenario];
  const invNo = invoiceNumber(cycle);

  // Pull breakdown metadata saved by NewConnectionForm (if any)
  const bd = cycle.breakdown || {};

  // originalPackagePrice:
  //   - from breakdown (new connection with discount) → bd.originalPackagePrice
  //   - from renewal  → cycle.totalAmount - previousBalance
  //   - fallback      → cycle.totalAmount
  const previousBalance = Number(cycle.previousBalance || 0);
  const originalPackagePrice =
    bd.originalPackagePrice != null
      ? Number(bd.originalPackagePrice)
      : Number(cycle.totalAmount) - previousBalance;

  const discountAmt = Number(bd.discountAmt || 0);
  const effectivePkgPrice = Number(
    bd.effectivePkgPrice != null
      ? bd.effectivePkgPrice
      : originalPackagePrice - discountAmt,
  );
  const materialTotal = Number(bd.materialTotal || 0);

  // Build a human-readable discount label
  let discountLabel = "";
  if (bd.discountType === "percent" && bd.discountValue > 0)
    discountLabel = `${bd.discountValue}%`;
  else if (bd.discountType === "amount" && bd.discountValue > 0)
    discountLabel = `PKR ${Number(bd.discountValue).toLocaleString()} off`;

  const totalAmount = Number(cycle.totalAmount);
  const amountPaid = Number(cycle.amountPaid || 0);
  const amountPending = Number(cycle.amountPending || 0);
  const installments = cycle.installments || [];

  const isCarriedForward = Number(cycle.shiftedAmount) > 0;
  const isPaid = amountPending === 0 && !isCarriedForward;

  // Material line items (stored in connection job — not on cycle directly,
  // but breakdown.materialItems may be stored if we add it later; graceful fallback)
  const materialItems = bd.materialItems || [];

  const invoiceProps = {
    invNo,
    scenarioMeta,
    customer,
    cycle,
    packageName,
    originalPackagePrice,
    discountAmt,
    discountLabel,
    effectivePkgPrice,
    materialTotal,
    materialItems,
    previousBalance,
    totalAmount,
    amountPaid,
    amountPending,
    installments,
  };

  const handlePrint = () => printInvoice(buildInvoiceHTML(invoiceProps));
  const handleSavePng = () => {
    toPng(invoiceRef.current, { pixelRatio: 3 }).then((dataUrl) => {
      const link = document.createElement("a");
      link.download = `${invNo}.png`;
      link.href = dataUrl;
      link.click();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700">
            Invoice Preview
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSavePng}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ImageDown size={13} /> Save PNG
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer size={13} /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="overflow-y-auto flex-1 p-5">
          <div
            ref={invoiceRef}
            className="bg-white p-6 font-sans text-gray-800 text-sm"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-gray-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wifi size={20} className="text-blue-600" />
                  <span className="text-xl font-black text-gray-900 tracking-tight">
                    Galaxy ISP
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Internet Service Provider
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-0.5">
                  Invoice
                </p>
                <p className="text-base font-black text-gray-900">{invNo}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Issued: {formatDate(cycle.cycleStartDate)}
                </p>
              </div>
            </div>

            {/* Scenario badge */}
            <div
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 mb-4 border text-xs font-semibold"
              style={{
                background: scenarioMeta.bg,
                borderColor: scenarioMeta.border,
                color: scenarioMeta.color,
              }}
            >
              {scenario === "new" && <Wifi size={12} />}
              {scenario === "renewal_clean" && <CheckCircle2 size={12} />}
              {scenario === "renewal_with_dues" && (
                <CornerDownRight size={12} />
              )}
              {scenarioMeta.label}
            </div>

            {/* Subscriber info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wide mb-0.5">
                  Subscriber
                </p>
                <p className="font-bold text-gray-900 text-sm">
                  {customer.fullName}
                </p>
                <p className="text-gray-500">{customer.userName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wide mb-0.5">
                  Contact
                </p>
                <p className="text-gray-700">{customer.mobileNo || "—"}</p>
                <p className="text-gray-500">{customer.mainArea || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wide mb-0.5">
                  Package
                </p>
                <p className="text-gray-700 font-medium">
                  {packageName || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wide mb-0.5">
                  Billing Period
                </p>
                <p className="text-gray-700">
                  {formatDate(cycle.cycleStartDate)} →{" "}
                  {formatDate(cycle.cycleEndDate)}
                </p>
              </div>
            </div>

            {/* Billing Breakdown */}
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">
                  Billing Breakdown
                </p>
              </div>
              <div className="px-4 py-3 space-y-2">
                {/* Package line */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    Package charge ({packageName})
                  </span>
                  <span className="font-semibold text-gray-800">
                    PKR {originalPackagePrice.toLocaleString()}
                  </span>
                </div>

                {/* Discount line */}
                {discountAmt > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-700 flex items-center gap-1.5">
                      <Tag size={12} className="shrink-0" />
                      Discount{discountLabel ? ` (${discountLabel})` : ""}
                    </span>
                    <span className="font-semibold text-green-700">
                      − PKR {discountAmt.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Material / Equipment */}
                {materialTotal > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-amber-700 flex items-center gap-1.5">
                        <Package size={12} className="shrink-0" />
                        Material / Equipment
                      </span>
                      <span className="font-semibold text-amber-700">
                        + PKR {materialTotal.toLocaleString()}
                      </span>
                    </div>
                    {materialItems.length > 0 && (
                      <div className="pl-5 space-y-1">
                        {materialItems.map((it, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-xs text-gray-400"
                          >
                            <span>
                              {it.description} × {it.qty} {it.unit}
                            </span>
                            <span>PKR {it.totalValue.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Previous balance */}
                {previousBalance > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-orange-600 flex items-center gap-1.5">
                      <CornerDownRight size={12} /> Previous unpaid balance
                    </span>
                    <span className="font-semibold text-orange-700">
                      + PKR {previousBalance.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Total */}
                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                  <span className="font-bold text-gray-800">Total Due</span>
                  <span className="font-black text-gray-900 text-base">
                    PKR {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Payments received */}
            {installments.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">
                    Payments Received
                  </p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {installments.map((inst, i) => (
                    <div
                      key={inst.id || i}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          size={13}
                          className="text-green-500 shrink-0"
                        />
                        <span className="text-gray-600">
                          {formatDate(inst.datePaid)}
                          {inst.note && (
                            <span className="text-gray-400 ml-1">
                              · {inst.note}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="font-semibold text-green-700">
                        PKR {Number(inst.amountPaid).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                    <span className="font-semibold text-gray-700">
                      Total Paid
                    </span>
                    <span className="font-bold text-green-700">
                      PKR {amountPaid.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            {isCarriedForward ? (
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <CornerDownRight
                    size={20}
                    className="text-orange-500 shrink-0"
                  />
                  <div>
                    <p className="font-bold text-orange-800 text-sm">
                      Unpaid — Carried Forward
                    </p>
                    <p className="text-xs text-orange-600">
                      PKR {Number(cycle.shiftedAmount).toLocaleString()} moved
                      to next cycle.
                    </p>
                  </div>
                </div>
                <p className="font-black text-orange-700 text-lg">
                  PKR {Number(cycle.shiftedAmount).toLocaleString()}
                </p>
              </div>
            ) : isPaid ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle2 size={20} className="text-green-600 shrink-0" />
                <div>
                  <p className="font-bold text-green-800 text-sm">
                    Paid in Full
                  </p>
                  <p className="text-xs text-green-600">
                    No outstanding balance. Thank you!
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="text-red-500 shrink-0" />
                  <div>
                    <p className="font-bold text-red-800 text-sm">
                      Balance Due
                    </p>
                    <p className="text-xs text-red-600">
                      Please pay at your earliest convenience.
                    </p>
                  </div>
                </div>
                <p className="font-black text-red-700 text-lg">
                  PKR {amountPending.toLocaleString()}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 pt-3 border-t border-gray-200 text-center text-[10px] text-gray-400">
              <p>Galaxy ISP · Thank you for your business</p>
              <p className="mt-0.5">
                Computer-generated invoice — no signature required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
