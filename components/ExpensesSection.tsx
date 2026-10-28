// "Spese" (like Splitwise) of an event or holiday: who paid what, each person's balance and the
// fewest payments to settle up ("Chi deve a chi"), with "Segna come saldato". A new expense is split
// equally among the chosen people (by default everyone who said "Ci sono").

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import * as api from '../lib/api';
import { balances, settlements, splitEqually } from '../lib/expenses';
import { firstName, formatEuro, parseEuro, timeAgo } from '../lib/format';
import type { Expense, User } from '../lib/types';
import { Button } from './Button';
import { Chip } from './Chip';

interface Props {
  eventId: string;
  myId: string;
  expenses: Expense[];
  participants: Pick<User, 'id' | 'full_name'>[]; // who said "Ci sono"
  people: Pick<User, 'id' | 'full_name'>[]; // to name anyone in the expenses
  isAdmin: boolean;
  ended: boolean; // after the event: "Conti finali"
  onChanged: () => void;
}

export function ExpensesSection({ eventId, myId, expenses, participants, people, isAdmin, ended, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const nameOf = (id: string) => (id === myId ? 'Tu' : firstName(people.find((p) => p.id === id)?.full_name ?? 'Qualcuno'));
  const objectName = (id: string) => (id === myId ? 'te' : nameOf(id)); // "pagato da te", "a te"

  const net = balances(expenses);
  const toSettle = settlements(net);
  const mine = net.get(myId) ?? 0;
  const total = expenses.filter((e) => !e.is_settlement).reduce((sum, e) => sum + e.amount_cents, 0);

  async function run(action: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-pixel text-ink">{ended ? 'Conti finali' : 'Spese'}</Text>
        {total ? <Text className="text-sm text-stone-500">Totale {formatEuro(total)}</Text> : null}
      </View>

      {expenses.length ? (
        <View className="gap-2 rounded-3xl border-2 border-b-4 border-line bg-emerald-50 p-4">
          <Text className="text-base font-pixel text-emerald-900">
            {mine > 0 ? `Ti devono ${formatEuro(mine)}` : mine < 0 ? `Devi ${formatEuro(-mine)}` : 'Sei in pari ✓'}
          </Text>
          {toSettle.length === 0 ? (
            <Text className="text-sm text-emerald-800">Tutti in pari: nessuno deve niente.</Text>
          ) : (
            toSettle.map((s) => (
              <View key={`${s.from}-${s.to}`} className="flex-row flex-wrap items-center gap-2">
                <Text className="flex-1 text-sm text-emerald-900">
                  <Text className="font-pixel">{nameOf(s.from)}</Text> → <Text className="font-pixel">{nameOf(s.to)}</Text>{' '}
                  {formatEuro(s.amount_cents)}
                </Text>
                {s.from === myId || s.to === myId ? (
                  <Button
                    title="Segna come saldato"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onPress={() =>
                      run(() =>
                        api.addExpense(eventId, {
                          description: 'Saldo',
                          amount_cents: s.amount_cents,
                          paid_by: s.from,
                          shares: [{ user_id: s.to, amount_cents: s.amount_cents }],
                          settlement: true,
                        }),
                      )
                    }
                  />
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : (
        <Text className="text-stone-500">Nessuna spesa. Chi paga qualcosa per il gruppo la aggiunge qui: i conti si fanno da soli.</Text>
      )}

      {expenses.length ? (
        <View className="overflow-hidden rounded-3xl border-2 border-b-4 border-line bg-white">
          {[...expenses].reverse().map((expense, index) => (
            <View key={expense.id} className={`flex-row items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-stone-100' : ''}`}>
              <Text className="text-xl">{expense.is_settlement ? '💸' : '🧾'}</Text>
              <View className="flex-1">
                <Text className="font-medium text-ink">
                  {expense.is_settlement
                    ? `${expense.paid_by === myId ? 'Hai dato' : `${nameOf(expense.paid_by)} ha dato`} ${formatEuro(expense.amount_cents)} a ${objectName(expense.shares[0]?.user_id ?? '')}`
                    : expense.description}
                </Text>
                <Text className="text-xs text-stone-500">
                  {expense.is_settlement
                    ? timeAgo(expense.created_at)
                    : `Pagato da ${objectName(expense.paid_by)} · diviso tra ${expense.shares.length} · ${timeAgo(expense.created_at)}`}
                </Text>
              </View>
              {expense.is_settlement ? null : <Text className="font-pixel text-ink">{formatEuro(expense.amount_cents)}</Text>}
              {expense.created_by === myId || expense.paid_by === myId || isAdmin ? (
                <Button title="Togli" size="sm" variant="muted" disabled={busy} onPress={() => run(() => api.deleteExpense(expense.id))} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {adding ? (
        <NewExpenseForm
          myId={myId}
          participants={participants}
          busy={busy}
          onCancel={() => setAdding(false)}
          onSave={(expense) =>
            run(async () => {
              await api.addExpense(eventId, expense);
              setAdding(false);
            })
          }
        />
      ) : (
        <Button title="Aggiungi una spesa" icon="add" variant="secondary" size="sm" onPress={() => setAdding(true)} />
      )}
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}

function NewExpenseForm({ myId, participants, busy, onCancel, onSave }: {
  myId: string;
  participants: Pick<User, 'id' | 'full_name'>[];
  busy: boolean;
  onCancel: () => void;
  onSave: (expense: { description: string; amount_cents: number; paid_by: string; shares: Expense['shares'] }) => void;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(myId);
  const [among, setAmong] = useState<string[]>(participants.map((p) => p.id));
  const [error, setError] = useState<string>();
  const label = (p: Pick<User, 'id' | 'full_name'>) => (p.id === myId ? 'Tu' : firstName(p.full_name));
  const cents = parseEuro(amount);

  function save() {
    if (!description.trim()) return setError('Scrivi per cosa è la spesa');
    if (!cents) return setError('Scrivi l’importo, es. 12,50');
    if (!among.length) return setError('Scegli tra chi dividerla');
    setError(undefined);
    onSave({ description, amount_cents: cents, paid_by: paidBy, shares: splitEqually(cents, among) });
  }

  return (
    <View className="gap-3 rounded-3xl border-2 border-b-4 border-line bg-white p-4">
      {/* One field per row: side by side, a web input can't shrink below ~20 characters and overflows */}
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Per cosa? Es. Pizza"
        placeholderTextColor="#A8A29E"
        maxLength={100}
        className="h-11 w-full rounded-2xl border-2 border-line bg-white px-4 text-base text-ink outline-none"
      />
      <View className="flex-row items-center gap-2">
        <Text className="text-lg font-pixel text-stone-600">€</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0,00"
          placeholderTextColor="#A8A29E"
          keyboardType="decimal-pad"
          accessibilityLabel="Importo in euro"
          className="h-11 w-32 rounded-2xl border-2 border-line bg-white px-4 text-base text-ink outline-none"
        />
      </View>
      <Text className="text-sm font-medium text-stone-700">Ha pagato</Text>
      <View className="flex-row flex-wrap gap-2">
        {participants.map((p) => (
          <Chip key={p.id} label={label(p)} selected={paidBy === p.id} onPress={() => setPaidBy(p.id)} />
        ))}
      </View>
      <Text className="text-sm font-medium text-stone-700">
        Da dividere tra{cents && among.length ? ` · ${formatEuro(Math.ceil(cents / among.length))} a testa` : ''}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {participants.map((p) => {
          const selected = among.includes(p.id);
          return (
            <Chip
              key={p.id}
              label={label(p)}
              selected={selected}
              onPress={() => setAmong(selected ? among.filter((id) => id !== p.id) : [...among, p.id])}
            />
          );
        })}
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button title="Aggiungi" icon="checkmark" size="sm" disabled={busy} onPress={save} />
        </View>
        <Button title="Annulla" size="sm" variant="muted" onPress={onCancel} />
      </View>
    </View>
  );
}
