import { useState, useEffect, useCallback, useRef } from "react";
import {
  User,
  Package,
  CreditCard,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Wrench,
  Tag,
  Info,
  Zap,
} from "lucide-react";
import { checkDuplicate } from "../../utils/duplicateCheck";
import { today } from "../../utils/dateUtils";
import usePackageStore from "../../store/usePackageStore";
import useCustomerStore from "../../store/useCustomerStore";
import usePaymentStore from "../../store/usePaymentStore";
import useInventoryStore from "../../store/useInventoryStore";
import useConnectionJobStore from "../../store/useConnectionJobStore";
import db from "../../db/database";

// ── CNIC formatter ─────────────────────────────────────────────────────────────
const formatCNIC = (val) => {
  const digits = val.replace(/\D/g, "").slice(0, 13);
  let res = "";
  if (digits.length > 0) res += digits.slice(0, 5);
  if (digits.length > 5) res += "-" + digits.slice(5, 12);
  if (digits.length > 12) res += "-" + digits.slice(12, 13);
  return res;
};

// ── Field wrapper ──────────────────────────────────────────────────────────────
function Field({ label, error, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inp = (err) =>
  `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    err ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
  }`;

function SectionTitle({ icon: Icon, color, title, badge }) {
  const colors = {
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    green: "bg-green-600",
    purple: "bg-purple-600",
  };
  return (
    <div className="flex items-center gap-2">
      <div
        className={`${colors[color] ?? "bg-gray-500"} rounded-lg p-1.5 shrink-0`}
      >
        <Icon size={14} className="text-white" />
      </div>
      <span className="text-sm font-bold text-gray-800">{title}</span>
      {badge && (
        <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NewConnectionForm({ onClose }) {
  // ── Stores ───────────────────────────────────────────────────────────────────
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const createInitialCycle = usePaymentStore((s) => s.createInitialCycle);
  const addInstallment = usePaymentStore((s) => s.addInstallment);
  const allPackages = usePackageStore((s) => s.packages);
  const packages = allPackages.filter((p) => p.isActive !== false);
  const inventoryItems = useInventoryStore((s) => s.items);
  const updateItem = useInventoryStore((s) => s.updateItem);
  const addJob = useConnectionJobStore((s) => s.addJob);

  // ── Settings ─────────────────────────────────────────────────────────────────
  const [areas, setAreas] = useState([]);
  const [agents, setAgents] = useState([]);
  useEffect(() => {
    db.settings.get("areas").then((r) => setAreas(r?.value ?? []));
    db.settings.get("agents").then((r) => setAgents(r?.value ?? []));
  }, []);

  // ── Section toggles ──────────────────────────────────────────────────────────
  const [showInventory, setShowInventory] = useState(false);
  const [showPayment, setShowPayment] = useState(true);

  // ── Subscriber fields ────────────────────────────────────────────────────────
  const [form, setFormState] = useState({
    fullName: "",
    userName: "",
    mobileNo: "",
    cnic: "",
    mainArea: "",
    recoveryAgent: "",
    packageId: "",
    notes: "",
    startDate: today(),
  });

  // ── Inventory fields ─────────────────────────────────────────────────────────
  const [technicianName, setTechnicianName] = useState("");
  const [jobNote, setJobNote] = useState("");
  const [lines, setLines] = useState([]);

  // ── Payment fields ───────────────────────────────────────────────────────────
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentNote, setPaymentNote] = useState("");

  // ── Discount fields ──────────────────────────────────────────────────────────
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState({});
  const [dupWarning, setDupWarning] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [savedSummary, setSavedSummary] = useState(null);

  // Track whether user manually edited the amount field
  const userEditedAmount = useRef(false);

  // ── Derived: package ─────────────────────────────────────────────────────────
  const selectedPkg = packages.find(
    (p) => Number(p.id) === Number(form.packageId),
  );
  const packagePrice = selectedPkg ? Number(selectedPkg.price) : 0;

  // ── Inventory totals ──────────────────────────────────────────────────────────
  const availableItems = inventoryItems.filter((i) => (i.inHand ?? 0) > 0);

  const lineDetails = lines.map((l) => {
    const item = inventoryItems.find((i) => i.id === Number(l.itemId));
    const qty = Number(l.qty) || 0;
    const rate = Number(l.customRate) || (item ? item.unitRate : 0);
    const total = qty * rate;
    const inHand = item ? (item.inHand ?? 0) : 0;
    const overIssue = qty > inHand;
    return { ...l, item, qty, rate, total, inHand, overIssue };
  });

  const materialTotal = lineDetails.reduce((s, l) => s + l.total, 0);

  // ── Discount ──────────────────────────────────────────────────────────────────
  const rawDiscount =
    discountType === "percent"
      ? (packagePrice * (Number(discountValue) || 0)) / 100
      : discountType === "amount"
        ? Number(discountValue) || 0
        : 0;
  const discountAmt = Math.min(Math.max(0, rawDiscount), packagePrice);
  const effectivePkgPrice = packagePrice - discountAmt;
  const grandTotal = effectivePkgPrice + (showInventory ? materialTotal : 0);

  // ── Auto-fill amountPaid when totals change ───────────────────────────────────
  useEffect(() => {
    if (!userEditedAmount.current) {
      setAmountPaid(grandTotal > 0 ? String(grandTotal) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grandTotal]);

  // ── Field helpers ─────────────────────────────────────────────────────────────
  const setField = (field, value) => {
    setFormState((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const checkDup = useCallback(
    async (field, value) => {
      if (!value) return setDupWarning(null);
      const result = await checkDuplicate(
        field === "userName" ? value : form.userName,
        field === "mobileNo" ? value : form.mobileNo,
        null,
      );
      if (result.hasDuplicate) {
        setDupWarning(
          `${field === "userName" ? "Username" : "Mobile"} already in use by: ${result.existing.fullName}`,
        );
      } else {
        setDupWarning(null);
      }
    },
    [form.userName, form.mobileNo],
  );

  // ── Inventory line helpers ────────────────────────────────────────────────────
  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), itemId: "", qty: "", customRate: "" },
    ]);

  const removeLine = (id) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setErrors((prev) => {
      const e = { ...prev };
      delete e[`item_${id}`];
      delete e[`qty_${id}`];
      delete e[`rate_${id}`];
      return e;
    });
  };

  const updateLine = (id, field, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === "itemId") {
          const item = inventoryItems.find((i) => i.id === Number(value));
          updated.customRate = item ? String(item.unitRate) : "";
        }
        return updated;
      }),
    );
    setErrors((prev) => {
      const e = { ...prev };
      delete e[`${field}_${id}`];
      return e;
    });
  };

  // ── Validation ────────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};

    if (!form.fullName.trim()) e.fullName = "Required";
    if (!form.userName.trim()) e.userName = "Required";
    if (!form.packageId) e.packageId = "Select a package";
    if (!form.mainArea) e.mainArea = "Select an area";

    if (form.mobileNo && !/^0\d{10}$/.test(form.mobileNo))
      e.mobileNo = "Must be 11 digits starting with 0 (e.g. 03001234567)";

    if (form.cnic && form.cnic.length < 15)
      e.cnic = "Invalid CNIC — 13 digits required";

    if (showInventory && lines.length > 0) {
      const seen = new Set();
      lineDetails.forEach((l) => {
        if (!l.itemId) e[`item_${l.id}`] = "Select an item";
        if (!l.qty || l.qty <= 0) e[`qty_${l.id}`] = "Enter qty > 0";
        if (l.overIssue) e[`qty_${l.id}`] = `Max: ${l.inHand} available`;
        if (!l.rate || l.rate <= 0) e[`rate_${l.id}`] = "Rate must be > 0";
        if (l.itemId && seen.has(l.itemId))
          e.inventoryGeneral = "Duplicate items — use one line per item.";
        seen.add(l.itemId);
      });
    }

    if (discountType === "percent") {
      const pct = Number(discountValue);
      if (isNaN(pct) || pct < 0 || pct > 100)
        e.discount = "Discount % must be between 0 and 100";
    }
    if (discountType === "amount") {
      const amt = Number(discountValue);
      if (isNaN(amt) || amt < 0 || amt > packagePrice)
        e.discount = `Cannot exceed package price PKR ${packagePrice.toLocaleString()}`;
    }

    if (showPayment && amountPaid !== "") {
      const amt = Number(amountPaid);
      if (isNaN(amt) || amt < 0) e.amountPaid = "Enter a valid amount";
    }
    if (showPayment && !paymentDate) e.paymentDate = "Required";

    return e;
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (dupWarning) return;

    setSaving(true);
    try {
      const pkgId = Number(form.packageId);
      const pkg = packages.find((p) => Number(p.id) === pkgId);
      const lockedPrice = pkg ? Number(pkg.price) : 0;

      // 1. Create subscriber
      const newCustomer = await addCustomer({
        fullName: form.fullName.trim(),
        userName: form.userName.trim(),
        mobileNo: form.mobileNo,
        cnic: form.cnic,
        mainArea: form.mainArea,
        recoveryAgent: form.recoveryAgent,
        packageId: pkgId,
        lockedPackagePrice: lockedPrice,
        status: "active",
        notes: form.notes,
      });

      // 2. Create billing cycle with grandTotal as totalAmount
      const newCycle = await createInitialCycle(
        newCustomer.id,
        form.startDate,
        grandTotal,
      );

      // Store breakdown metadata on the cycle for invoice rendering
      const breakdown = {
        originalPackagePrice: lockedPrice,
        discountType: discountType !== "none" ? discountType : null,
        discountValue: discountType !== "none" ? Number(discountValue) || 0 : 0,
        discountAmt,
        effectivePkgPrice,
        materialTotal: showInventory ? materialTotal : 0,
      };
      await db.paymentCycles.update(newCycle.id, { breakdown });
      newCycle.breakdown = breakdown; // patch in-memory

      // 3. Record payment
      const paidAmt = Number(amountPaid) || 0;
      if (showPayment && paidAmt > 0) {
        await addInstallment(
          newCycle.id,
          paidAmt,
          paymentDate,
          paymentNote || "",
        );
      }

      // 4. Issue inventory items
      let savedJob = null;
      if (showInventory && lines.length > 0) {
        const validLines = lineDetails.filter(
          (l) => l.itemId && l.qty > 0 && l.item,
        );
        if (validLines.length > 0) {
          const issuedItems = [];
          for (const l of validLines) {
            const item = l.item;
            const existingLog = Array.isArray(item.issueLog)
              ? item.issueLog
              : [];
            const newStockOut = (item.stockOut || 0) + l.qty;
            const newInHand = (item.stockIn || 0) - newStockOut;

            await updateItem(item.id, {
              ...item,
              stockOut: newStockOut,
              inHand: newInHand,
              balanced: newInHand,
              issued: newStockOut,
              issueLog: [
                ...existingLog,
                {
                  date: form.startDate,
                  qty: l.qty,
                  issuedTo: technicianName.trim() || null,
                  subscriberName: newCustomer.fullName,
                  subscriberUsername: newCustomer.userName,
                  note: jobNote.trim() || "New Connection",
                  balanceAfter: newInHand,
                  unitRate: l.rate,
                  totalValue: l.total,
                  jobRef: true,
                  createdAt: new Date().toISOString(),
                },
              ],
            });

            issuedItems.push({
              inventoryItemId: item.id,
              description: item.description,
              unit: item.unit,
              qty: l.qty,
              unitRate: l.rate,
              totalValue: l.total,
            });
          }

          savedJob = await addJob({
            date: form.startDate,
            technicianName: technicianName.trim() || null,
            subscriberName: newCustomer.fullName,
            subscriberUsername: newCustomer.userName,
            subscriberId: newCustomer.id,
            note: jobNote.trim() || null,
            items: issuedItems,
            totalValue: materialTotal,
          });
        }
      }

      setSavedSummary({
        customer: newCustomer,
        paidAmt,
        grandTotal,
        discountAmt,
        effectivePkgPrice,
        materialTotal: showInventory ? materialTotal : 0,
        job: savedJob,
        packageName: pkg?.name ?? "—",
      });
      setDone(true);
    } catch (err) {
      setErrors({ general: "Error saving: " + err.message });
    }
    setSaving(false);
  };

  // ── Success screen ─────────────────────────────────────────────────────────────
  if (done && savedSummary) {
    const remaining = savedSummary.grandTotal - savedSummary.paidAmt;
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              Connection Created!
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {savedSummary.customer.fullName} ({savedSummary.customer.userName}
              ) added successfully.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Package — {savedSummary.packageName}</span>
            <span>PKR {packagePrice.toLocaleString()}</span>
          </div>
          {savedSummary.discountAmt > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount</span>
              <span>− PKR {savedSummary.discountAmt.toLocaleString()}</span>
            </div>
          )}
          {savedSummary.materialTotal > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Material / Equipment</span>
              <span>+ PKR {savedSummary.materialTotal.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
            <span>Total Due</span>
            <span>PKR {savedSummary.grandTotal.toLocaleString()}</span>
          </div>
          {savedSummary.paidAmt > 0 && (
            <div className="flex justify-between text-green-700">
              <span className="font-semibold">Paid Now</span>
              <span className="font-bold">
                PKR {savedSummary.paidAmt.toLocaleString()}
              </span>
            </div>
          )}
          {remaining > 0 ? (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
              <span className="font-semibold">Remaining Balance</span>
              <span className="font-bold">
                PKR {remaining.toLocaleString()}
              </span>
            </div>
          ) : savedSummary.paidAmt > 0 ? (
            <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold pt-0.5">
              <CheckCircle2 size={13} /> Fully paid
            </div>
          ) : null}
        </div>

        {savedSummary.job && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1.5">
              📦 {savedSummary.job.items.length} item
              {savedSummary.job.items.length !== 1 ? "s" : ""} issued from
              inventory
            </p>
            {savedSummary.job.items.map((item, i) => (
              <p key={i} className="text-xs text-blue-700 leading-relaxed">
                {item.description} × {item.qty} {item.unit} = PKR{" "}
                {item.totalValue.toLocaleString()}
              </p>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── FORM ─────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ══ SECTION 1: SUBSCRIBER ══════════════════════════════════════════════ */}
      <div className="border border-gray-200 rounded-xl p-5">
        <div className="mb-4">
          <SectionTitle
            icon={User}
            color="blue"
            title="Subscriber Information"
          />
        </div>

        {dupWarning && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
            ⚠ {dupWarning}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name *" error={errors.fullName}>
            <input
              className={inp(errors.fullName)}
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              placeholder="e.g. Muhammad Qasim"
            />
          </Field>

          <Field label="Username *" error={errors.userName}>
            <input
              className={inp(errors.userName)}
              value={form.userName}
              onChange={(e) => {
                setField("userName", e.target.value);
                checkDup("userName", e.target.value);
              }}
              placeholder="e.g. Qasim6655"
            />
          </Field>

          <Field label="Mobile No" error={errors.mobileNo}>
            <input
              className={inp(errors.mobileNo)}
              value={form.mobileNo}
              type="tel"
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                setField("mobileNo", val);
                checkDup("mobileNo", val);
              }}
              placeholder="03001234567"
            />
          </Field>

          <Field label="CNIC (Optional)" error={errors.cnic}>
            <input
              className={inp(errors.cnic)}
              value={form.cnic}
              onChange={(e) => setField("cnic", formatCNIC(e.target.value))}
              placeholder="35202-1234567-1"
              maxLength={15}
            />
          </Field>

          <Field label="Package *" error={errors.packageId}>
            <select
              className={inp(errors.packageId)}
              value={form.packageId}
              onChange={(e) => {
                setField("packageId", e.target.value);
                setDiscountValue("");
                userEditedAmount.current = false;
              }}
            >
              <option value="">— Select Package —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — PKR {Number(p.price).toLocaleString()}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Main Area *" error={errors.mainArea}>
            <select
              className={inp(errors.mainArea)}
              value={form.mainArea}
              onChange={(e) => setField("mainArea", e.target.value)}
            >
              <option value="">— Select Area —</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Recovery Agent">
            <select
              className={inp()}
              value={form.recoveryAgent}
              onChange={(e) => setField("recoveryAgent", e.target.value)}
            >
              <option value="">— Select Agent —</option>
              {agents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Connection Start Date *">
            <input
              type="date"
              className={inp()}
              value={form.startDate}
              max={today()}
              onChange={(e) => setField("startDate", e.target.value)}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Notes (optional)">
              <textarea
                className={inp() + " resize-none"}
                rows={2}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Any notes about this connection..."
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ══ SECTION 2: DISCOUNT ════════════════════════════════════════════════ */}
      {selectedPkg && (
        <div className="border border-gray-200 rounded-xl p-5">
          <div className="mb-4">
            <SectionTitle
              icon={Tag}
              color="green"
              title="Discount"
              badge="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Discount Type">
              <select
                className={inp(errors.discount)}
                value={discountType}
                onChange={(e) => {
                  setDiscountType(e.target.value);
                  setDiscountValue("");
                  setErrors((ex) => ({ ...ex, discount: "" }));
                  userEditedAmount.current = false;
                }}
              >
                <option value="none">No Discount</option>
                <option value="percent">Percentage (%)</option>
                <option value="amount">Fixed Amount (PKR)</option>
              </select>
            </Field>

            {discountType !== "none" && (
              <Field
                label={
                  discountType === "percent"
                    ? "Discount %"
                    : "Discount Amount (PKR)"
                }
                error={errors.discount}
                hint={
                  discountType === "percent" && Number(discountValue) > 0
                    ? `= PKR ${discountAmt.toLocaleString()} off`
                    : undefined
                }
              >
                <input
                  type="number"
                  min="0"
                  max={discountType === "percent" ? 100 : packagePrice}
                  className={inp(errors.discount)}
                  value={discountValue}
                  onChange={(e) => {
                    setDiscountValue(e.target.value);
                    setErrors((ex) => ({ ...ex, discount: "" }));
                    userEditedAmount.current = false;
                  }}
                  placeholder={
                    discountType === "percent" ? "e.g. 10" : "e.g. 500"
                  }
                />
              </Field>
            )}
          </div>

          {discountType !== "none" && discountAmt > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm">
              <CheckCircle size={14} className="text-green-600 shrink-0" />
              <span className="text-green-800">
                Discount of <strong>PKR {discountAmt.toLocaleString()}</strong>{" "}
                applied — effective package price:{" "}
                <strong>PKR {effectivePkgPrice.toLocaleString()}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ══ SECTION 3: INVENTORY ═══════════════════════════════════════════════ */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowInventory((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <SectionTitle
            icon={Package}
            color="amber"
            title="Issue Inventory Items"
            badge={showInventory ? undefined : "Optional"}
          />
          <div className="flex items-center gap-3">
            {showInventory && materialTotal > 0 && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                PKR {materialTotal.toLocaleString()} material
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform ${showInventory ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {showInventory && (
          <div className="px-5 pb-5 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
              <Field label="Technician Name">
                <div className="relative">
                  <Wrench
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder="e.g. Ali Khan"
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </Field>
              <Field label="Job Note (optional)">
                <input
                  type="text"
                  placeholder="e.g. New connection Gulshan B5"
                  value={jobNote}
                  onChange={(e) => setJobNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Items to Issue
              </span>
              <button
                onClick={addLine}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            {lines.length === 0 ? (
              <div
                onClick={addLine}
                className="border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                <Package size={20} className="opacity-40" />
                <p className="text-xs font-medium">Click to add first item</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lineDetails.map((l) => {
                  const usedIds = lineDetails
                    .filter((x) => x.id !== l.id && x.itemId)
                    .map((x) => Number(x.itemId));
                  const opts = availableItems.filter(
                    (i) => !usedIds.includes(i.id),
                  );
                  return (
                    <div
                      key={l.id}
                      className={`border rounded-xl p-3 space-y-2 ${l.overIssue ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <select
                            value={l.itemId}
                            onChange={(e) =>
                              updateLine(l.id, "itemId", e.target.value)
                            }
                            className={`w-full border rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors[`item_${l.id}`] ? "border-red-400" : "border-gray-300"}`}
                          >
                            <option value="">-- Select item --</option>
                            {opts.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.description} ({i.inHand} {i.unit} available)
                              </option>
                            ))}
                          </select>
                          {errors[`item_${l.id}`] && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {errors[`item_${l.id}`]}
                            </p>
                          )}
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={l.qty}
                            onChange={(e) =>
                              updateLine(l.id, "qty", e.target.value)
                            }
                            className={`w-full border rounded-lg px-2 h-9 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`qty_${l.id}`] ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                          />
                          {errors[`qty_${l.id}`] && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {errors[`qty_${l.id}`]}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeLine(l.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {l.item && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">PKR</span>
                            <input
                              type="number"
                              min="1"
                              value={l.customRate}
                              onChange={(e) =>
                                updateLine(l.id, "customRate", e.target.value)
                              }
                              className={`w-24 border rounded-lg px-2 h-8 text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`rate_${l.id}`] ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                            />
                            <span className="text-xs text-gray-400">
                              per {l.item.unit}
                            </span>
                          </div>
                          {l.qty > 0 && l.rate > 0 && (
                            <span className="ml-auto text-sm font-bold text-gray-800">
                              = PKR {l.total.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                      {l.overIssue && (
                        <p className="flex items-center gap-1 text-xs text-red-600 font-semibold">
                          <AlertTriangle size={11} /> Only {l.inHand}{" "}
                          {l.item?.unit} in stock
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {errors.inventoryGeneral && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mt-2">
                <AlertTriangle size={13} /> {errors.inventoryGeneral}
              </div>
            )}

            {lines.length > 0 && materialTotal > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Total Material Cost
                </span>
                <span className="text-base font-black text-amber-700">
                  PKR {materialTotal.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ SECTION 4: PAYMENT ════════════════════════════════════════════════ */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPayment((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <SectionTitle
            icon={CreditCard}
            color="purple"
            title="Record First Payment"
            badge={showPayment ? undefined : "Optional"}
          />
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${showPayment ? "rotate-180" : ""}`}
          />
        </button>

        {showPayment && (
          <div className="px-5 pb-5 border-t border-gray-100">
            {selectedPkg && (
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1.5 text-sm mb-4">
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-2 flex items-center gap-1">
                  <Info size={11} /> Billing Summary
                </p>
                <div className="flex justify-between text-gray-600">
                  <span>Package — {selectedPkg.name}</span>
                  <span>PKR {packagePrice.toLocaleString()}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount</span>
                    <span>− PKR {discountAmt.toLocaleString()}</span>
                  </div>
                )}
                {showInventory && materialTotal > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Material / Equipment</span>
                    <span>+ PKR {materialTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
                  <span>Total Due</span>
                  <span>PKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Amount Paid (leave blank to skip)"
                error={errors.amountPaid}
              >
                <input
                  type="number"
                  min="0"
                  className={inp(errors.amountPaid)}
                  value={amountPaid}
                  onChange={(e) => {
                    userEditedAmount.current = true;
                    setAmountPaid(e.target.value);
                    setErrors((ex) => ({ ...ex, amountPaid: "" }));
                  }}
                  placeholder={`Total: PKR ${grandTotal.toLocaleString()}`}
                />
              </Field>

              <Field label="Payment Date *" error={errors.paymentDate}>
                <input
                  type="date"
                  className={inp(errors.paymentDate)}
                  value={paymentDate}
                  max={today()}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </Field>

              <div className="col-span-2">
                <Field label="Payment Note (optional)">
                  <input
                    className={inp()}
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="e.g. Cash, JazzCash, EasyPaisa..."
                  />
                </Field>
              </div>
            </div>

            {selectedPkg && Number(amountPaid) > 0 && (
              <div
                className={`mt-3 flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  Number(amountPaid) >= grandTotal
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-50 text-yellow-800 border border-yellow-200"
                }`}
              >
                <span>
                  {Number(amountPaid) >= grandTotal
                    ? "✓ Fully Paid"
                    : "Remaining Balance"}
                </span>
                <span>
                  {Number(amountPaid) >= grandTotal
                    ? "PKR 0"
                    : `PKR ${(grandTotal - Number(amountPaid)).toLocaleString()}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ ERRORS + FOOTER ═══════════════════════════════════════════════════ */}
      {errors.general && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
          <AlertTriangle size={14} /> {errors.general}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1 pb-1">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !!dupWarning}
          className="flex items-center gap-2 px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            "Saving..."
          ) : (
            <>
              <Zap size={14} />
              Create Connection
              {grandTotal > 0 && (
                <span className="opacity-70 text-xs font-normal">
                  · PKR{" "}
                  {(userEditedAmount.current && Number(amountPaid) >= 0
                    ? Number(amountPaid)
                    : grandTotal
                  ).toLocaleString()}
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
