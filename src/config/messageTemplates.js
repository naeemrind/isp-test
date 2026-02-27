export const MESSAGE_TEMPLATES = {
  paymentDue: (customer, cycle) =>
    `Assalam o Alaikum *${customer.fullName}*,\n\nYour internet bill of *PKR ${cycle.amountPending}* is due. Please pay to continue uninterrupted service.\n\nThank you,\n*Galaxy Internet*`,

  paymentOverdue: (customer, cycle) =>
    `Assalam o Alaikum *${customer.fullName}*,\n\nYour account is overdue. Your service has been suspended.\n\nPlease pay *PKR ${cycle.totalAmount}* to reconnect.\n\nThank you,\n*Galaxy Internet*`,

  paymentConfirmation: (customer, installment) =>
    `Assalam o Alaikum *${customer.fullName}*,\n\nWe received your payment of *PKR ${installment.amountPaid}* on ${installment.datePaid}. Thank you!\n\nYour account is now updated.\n\n*Galaxy Internet*`,

  expiryReminder: (customer, cycle) =>
    `Assalam o Alaikum *${customer.fullName}*,\n\nYour internet plan expires on *${cycle.cycleEndDate}*. Please renew to avoid service interruption.\n\nThank you,\n*Galaxy Internet*`,

  partialPaymentReceived: (customer, installment, remaining) =>
    `Assalam o Alaikum *${customer.fullName}*,\n\nWe received *PKR ${installment.amountPaid}* on ${installment.datePaid}.\n\nRemaining balance: *PKR ${remaining}*\n\nPlease pay the remaining amount soon.\n\n*Galaxy Internet*`,
};

export const generateWhatsAppLink = (mobileNo, message) => {
  if (!mobileNo) return null;
  const cleaned = String(mobileNo).replace(/\D/g, "");
  const withCode = cleaned.startsWith("92") ? cleaned : `92${cleaned}`;
  return `https://wa.me/${withCode}?text=${encodeURIComponent(message)}`;
};
