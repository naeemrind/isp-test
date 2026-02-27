import { useState, useEffect } from "react";
import { AlertTriangle, Trash2, Eye, EyeOff, Archive } from "lucide-react";
import Modal from "./Modal";

// Updated to match your Login credentials
const ADMIN_PASSWORD = "admin1357";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  confirmText = null,
  requirePassword = false,
  showReason = false,
  reasonLabel = "Reason (optional)",
}) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setTyped("");
        setPassword("");
        setPwError("");
        setShowPw(false);
        setReason("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, confirmText]);

  const nameOk = confirmText
    ? typed.trim() === confirmText.trim() && typed.length > 0
    : true;
  const passwordOk = requirePassword ? password === ADMIN_PASSWORD : true;
  const canConfirm =
    nameOk && (requirePassword ? password.length > 0 && passwordOk : true);

  const handleConfirm = () => {
    if (confirmText && !nameOk) return;
    if (requirePassword && password !== ADMIN_PASSWORD) {
      setPwError("Incorrect admin password.");
      return;
    }
    onConfirm(reason);
    onClose();
  };

  let stepNum = 0;
  const stepCount = [confirmText, requirePassword].filter(Boolean).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        {/* Warning */}
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <p className="text-sm text-red-800 leading-relaxed pt-0.5">
            {message}
          </p>
        </div>

        {/* Optional reason */}
        {showReason && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600">
              {reasonLabel}
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Customer relocated, Duplicate entry..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        {/* Step: type name */}
        {confirmText && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600">
              {stepCount > 1 ? `Step ${++stepNum} — ` : ""}Type the customer
              name to confirm:
            </label>
            <div className="bg-gray-100 rounded px-2 py-1 text-xs font-mono font-bold text-gray-800 inline-block mb-1">
              {confirmText}
            </div>
            <input
              autoFocus
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                typed.length > 0 && !nameOk
                  ? "border-red-300 focus:ring-red-400 bg-red-50"
                  : nameOk
                    ? "border-green-400 focus:ring-green-400 bg-green-50"
                    : "border-gray-300 focus:ring-blue-500"
              }`}
              placeholder={`Type "${confirmText}"`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
            {typed.length > 0 && !nameOk && (
              <p className="text-xs text-red-500">
                Name does not match. Check spelling and capitalisation.
              </p>
            )}
            {nameOk && (
              <p className="text-xs text-green-600 font-semibold">
                ✓ Name confirmed
              </p>
            )}
          </div>
        )}

        {/* Step: admin password */}
        {requirePassword && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600">
              {stepCount > 1 ? `Step ${++stepNum} — ` : ""}Enter admin password:
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 transition-colors ${
                  pwError
                    ? "border-red-300 focus:ring-red-400 bg-red-50"
                    : passwordOk && password.length > 0
                      ? "border-green-400 focus:ring-green-400 bg-green-50"
                      : "border-gray-300 focus:ring-blue-500"
                }`}
                placeholder="Admin password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPwError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pwError && (
              <p className="text-xs text-red-500 font-medium">{pwError}</p>
            )}
            {passwordOk && password.length > 0 && (
              <p className="text-xs text-green-600 font-semibold">
                ✓ Password correct
              </p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 text-sm rounded-lg font-semibold text-white flex items-center gap-1.5 ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {danger && <Archive size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
