// Shared expenses, like Splitwise: each person's balance (what they paid minus their shares) and
// the fewest payments that settle everything ("Bruno → Anna 12,50 €"). Amounts are euro cents.

import type { Expense } from './types';

export interface Settlement {
  from: string; // who owes
  to: string; // who gets paid
  amount_cents: number;
}

// user -> net cents: positive = they're owed money, negative = they owe
export function balances(expenses: Expense[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (user: string, cents: number) => net.set(user, (net.get(user) ?? 0) + cents);
  for (const expense of expenses) {
    add(expense.paid_by, expense.amount_cents);
    for (const share of expense.shares) add(share.user_id, -share.amount_cents);
  }
  return net;
}

// Greedy: the biggest debtor pays the biggest creditor, until everyone is even
export function settlements(net: Map<string, number>): Settlement[] {
  const debtors = [...net].filter(([, c]) => c < 0).map(([user, c]) => ({ user, cents: -c }));
  const creditors = [...net].filter(([, c]) => c > 0).map(([user, c]) => ({ user, cents: c }));
  const result: Settlement[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.cents - a.cents);
    creditors.sort((a, b) => b.cents - a.cents);
    const [debtor, creditor] = [debtors[0], creditors[0]];
    const amount = Math.min(debtor.cents, creditor.cents);
    result.push({ from: debtor.user, to: creditor.user, amount_cents: amount });
    debtor.cents -= amount;
    creditor.cents -= amount;
    if (!debtor.cents) debtors.shift();
    if (!creditor.cents) creditors.shift();
  }
  return result;
}

// Equal shares; the leftover cents go to the first people (1000 among 3 -> 334, 333, 333)
export function splitEqually(amountCents: number, userIds: string[]): { user_id: string; amount_cents: number }[] {
  const base = Math.floor(amountCents / userIds.length);
  const rest = amountCents - base * userIds.length;
  return userIds.map((user_id, i) => ({ user_id, amount_cents: base + (i < rest ? 1 : 0) }));
}
