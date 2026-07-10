/**
 * Calculates net balances for a flat based on all expenses and settlements.
 * @param {Array} expenses - List of all Expense documents for the flat
 * @param {Array} settlements - List of all Settlement documents for the flat
 * @returns {Array} List of debts in the format: { from: userId, to: userId, amount: number }
 */
const calculateBalances = (expenses, settlements) => {
  const balances = {};

  // 1. Calculate net balance for each user from expenses
  expenses.forEach(expense => {
    const paidBy = expense.paidBy.toString();
    
    // Add to paidBy's balance (they are owed this money)
    if (!balances[paidBy]) balances[paidBy] = 0;
    balances[paidBy] += expense.amount;

    // Subtract from each split member's balance (they owe this money)
    expense.splitAmong.forEach(split => {
      const user = split.user.toString();
      if (!balances[user]) balances[user] = 0;
      balances[user] -= split.amount;
    });
  });

  // 2. Adjust balances based on settlements
  settlements.forEach(settlement => {
    const from = settlement.from.toString();
    const to = settlement.to.toString();
    const amount = settlement.amount;

    if (!balances[from]) balances[from] = 0;
    if (!balances[to]) balances[to] = 0;

    // 'from' paid 'to'. So 'from' gets their balance increased, 'to' gets theirs decreased.
    balances[from] += amount;
    balances[to] -= amount;
  });

  // Fix floating point precision
  Object.keys(balances).forEach(key => {
    balances[key] = Math.round(balances[key] * 100) / 100;
  });

  // 3. Simplify debts (minimize transactions)
  const debtors = []; // People who owe money (balance < 0)
  const creditors = []; // People who are owed money (balance > 0)

  Object.keys(balances).forEach(user => {
    if (balances[user] < 0) {
      debtors.push({ user, amount: Math.abs(balances[user]) });
    } else if (balances[user] > 0) {
      creditors.push({ user, amount: balances[user] });
    }
  });

  // Sort by amount descending
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const simplifiedDebts = [];
  let i = 0; // debtors index
  let j = 0; // creditors index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(debtor.amount, creditor.amount);
    
    // Round to 2 decimals
    const roundedAmount = Math.round(amount * 100) / 100;

    if (roundedAmount > 0) {
      simplifiedDebts.push({
        from: debtor.user,
        to: creditor.user,
        amount: roundedAmount
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (Math.abs(debtor.amount) < 0.01) i++;
    if (Math.abs(creditor.amount) < 0.01) j++;
  }

  return simplifiedDebts;
};

module.exports = calculateBalances;
