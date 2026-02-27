// src/components/ui/HistoryModal.jsx
import {
  Calendar,
  ArrowRight,
  Wallet,
  CheckCircle,
  AlertCircle,
  Receipt,
} from "lucide-react";
import Modal from "./Modal";
import Badge from "./Badge";
import usePaymentStore from "../../store/usePaymentStore";
import { formatDate } from "../../utils/dateUtils";

export default function HistoryModal({ customer, onClose }) {
  const getCyclesForCustomer = usePaymentStore((s) => s.getCyclesForCustomer);

  if (!customer) return null;

  const cycles = getCyclesForCustomer(customer.id);

  // Quick Summary Computations
  const totalPending = cycles.reduce(
    (sum, c) => sum + (c.amountPending || 0),
    0,
  );
  const totalCycles = cycles.length;

  return (
    <Modal
      isOpen={!!customer}
      onClose={onClose}
      title={`Payment History: ${customer.fullName}`}
      size="3xl" // <--- Set to the newly created 1200px size
    >
      <div className="space-y-6">
        {/* ── TOP SUMMARY DASHBOARD ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex flex-col justify-center items-center text-center">
            <span className="text-blue-600/80 text-[10px] font-bold uppercase tracking-wider mb-1">
              Total Cycles
            </span>
            <span className="text-xl font-black text-blue-700">
              {totalCycles}
            </span>
          </div>

          <div
            className={`p-3 rounded-xl border flex flex-col justify-center items-center text-center shadow-sm ${
              totalPending > 0
                ? "bg-red-50 border-red-200"
                : "bg-green-50 border-green-200"
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                totalPending > 0 ? "text-red-600/80" : "text-green-600/80"
              }`}
            >
              Total Unpaid Balance
            </span>
            <span
              className={`text-xl font-black ${totalPending > 0 ? "text-red-600" : "text-green-600"}`}
            >
              PKR {totalPending.toLocaleString()}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex flex-col justify-center items-center text-center">
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              Account Status
            </span>
            <Badge status={customer.status} />
          </div>
        </div>

        {/* ── TIMELINE OF CYCLES ── */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
          {cycles.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
              <Wallet size={36} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium text-gray-500">
                No payment history found.
              </p>
              <p className="text-xs mt-1">
                Billing cycles will appear here once created.
              </p>
            </div>
          ) : (
            cycles.map((cycle) => {
              const isClear = cycle.amountPending === 0;
              const percentPaid =
                cycle.totalAmount > 0
                  ? Math.min(
                      100,
                      Math.round((cycle.amountPaid / cycle.totalAmount) * 100),
                    )
                  : 0;

              return (
                <div
                  key={cycle.id}
                  className={`border-2 rounded-xl overflow-hidden transition-colors ${
                    isClear
                      ? "border-gray-100 bg-white"
                      : "border-orange-200 bg-orange-50/10"
                  }`}
                >
                  {/* Cycle Header */}
                  <div
                    className={`px-4 py-3 border-b flex justify-between items-center ${
                      isClear
                        ? "bg-gray-50/70 border-gray-100"
                        : "bg-orange-50 border-orange-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar
                        size={16}
                        className={
                          isClear ? "text-gray-400" : "text-orange-500"
                        }
                      />
                      <span className="text-sm font-bold text-gray-800 tracking-tight">
                        {formatDate(cycle.cycleStartDate)}
                        <span className="mx-2 text-gray-400 font-normal">
                          to
                        </span>
                        {formatDate(cycle.cycleEndDate)}
                      </span>
                    </div>
                    <Badge status={cycle.status} />
                  </div>

                  <div className="p-4">
                    {/* Financials Row */}
                    <div className="flex items-center justify-between mb-3 text-sm px-2">
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase font-bold text-gray-400 flex items-center gap-1 mb-0.5">
                          <Receipt size={12} /> Total Bill
                        </span>
                        <span className="font-extrabold text-gray-800 text-base">
                          PKR {cycle.totalAmount}
                        </span>
                      </div>

                      <div className="w-px h-8 bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase font-bold text-gray-400 flex items-center gap-1 mb-0.5">
                          <CheckCircle size={12} className="text-green-500" />{" "}
                          Paid
                        </span>
                        <span className="font-extrabold text-green-600 text-base">
                          PKR {cycle.amountPaid}
                        </span>
                      </div>

                      <div className="w-px h-8 bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase font-bold text-gray-400 flex items-center gap-1 mb-0.5">
                          <AlertCircle
                            size={12}
                            className={
                              !isClear ? "text-red-500" : "text-gray-400"
                            }
                          />{" "}
                          Pending
                        </span>
                        <span
                          className={`font-extrabold text-base ${!isClear ? "text-red-600" : "text-gray-400"}`}
                        >
                          PKR {cycle.amountPending}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden mt-2">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${isClear ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${percentPaid}%` }}
                      ></div>
                    </div>

                    {/* Installments List */}
                    {cycle.installments && cycle.installments.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                          <Wallet size={12} /> Payments Received
                        </div>
                        <div className="space-y-2">
                          {cycle.installments.map((inst) => (
                            <div
                              key={inst.id}
                              className="flex justify-between items-center bg-white px-3 py-2 rounded border border-gray-100 shadow-sm hover:border-gray-300 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-green-100 text-green-600 p-1.5 rounded-full">
                                  <CheckCircle size={13} strokeWidth={2.5} />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-gray-800">
                                    {formatDate(inst.datePaid)}
                                  </div>
                                  {inst.note && (
                                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium leading-none">
                                      Via: {inst.note}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm font-bold text-gray-800">
                                PKR {inst.amountPaid}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Close Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 text-sm font-bold rounded-lg transition-colors focus:ring-2 focus:ring-gray-300 focus:outline-none"
          >
            Close History
          </button>
        </div>
      </div>
    </Modal>
  );
}
