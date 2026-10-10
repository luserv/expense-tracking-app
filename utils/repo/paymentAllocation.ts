/** Pure allocation of historical loan payments over installments (no DB access). */

export interface PaymentRecord {
  amount: number;
  date: string;
}

export interface InstallmentAllocation {
  paidAmount: number;
  paidDate: string | null;
}

const toCents = (n: number) => Math.round(n * 100);

/**
 * Applies payments, oldest first, to installments in order. Each installment
 * records how much it received and the date of the last payment that
 * contributed to it. Works in integer cents to avoid floating-point drift;
 * anything paid beyond the installments' total is not allocated.
 */
export function allocatePayments(amounts: number[], payments: PaymentRecord[]): InstallmentAllocation[] {
  let payIdx = 0;
  let leftInPayment = payments.length ? toCents(payments[0].amount) : 0;

  return amounts.map(amount => {
    let due = toCents(amount);
    let paid = 0;
    let paidDate: string | null = null;

    while (due > 0 && payIdx < payments.length) {
      if (leftInPayment <= 0) {
        payIdx++;
        leftInPayment = payIdx < payments.length ? toCents(payments[payIdx].amount) : 0;
        continue;
      }
      const take = Math.min(due, leftInPayment);
      due -= take;
      paid += take;
      leftInPayment -= take;
      paidDate = payments[payIdx].date;
    }

    return { paidAmount: paid / 100, paidDate };
  });
}
