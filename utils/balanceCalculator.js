/**
 * Calculates net balances for a flat based on all expenses and settlements.
 * @param {Array} expenses - List of all Expense documents for the flat
 * @param {Array} settlements - List of all Settlement documents for the flat
 * @param {String} settlementType - 'overall' (simplified) or 'one-to-one' (detailed)
 * @returns {Array} List of debts in the format: { from: userId, to: userId, amount: number }
 */
const calculateBalances = (expenses, settlements, settlementType = 'overall') => {
  if (settlementType === 'one-to-one') {
    // One-to-one logic: track exact peer-to-peer debts
    const debts = {}; // debts[from][to] = amount

    const addDebt = (from, to, amount) => {
      if (from === to) return;
      if (!debts[from]) debts[from] = {};
      if (!debts[from][to]) debts[from][to] = 0;
      debts[from][to] += amount;
    };

    expenses.forEach(expense => {
      const paidBy = expense.paidBy.toString();
      expense.splitAmong.forEach(split => {
        const user = split.user.toString();
        addDebt(user, paidBy, split.amount);
      });
    });

    settlements.forEach(settlement => {
      const from = settlement.from.toString();
      const to = settlement.to.toString();
      // A settlement is 'from' paying 'to'. This reduces the debt that 'from' owes 'to'.
      // We represent this by adding a counter-debt: 'to' owes 'from' the settlement amount.
      // The net calculation will naturally cancel it out.
      addDebt(to, from, settlement.amount);
    });

    const rawDebts = [];
    const processedPairs = new Set();

    Object.keys(debts).forEach(from => {
      Object.keys(debts[from]).forEach(to => {
        const pairId = [from, to].sort().join('-');
        if (processedPairs.has(pairId)) return;
        processedPairs.add(pairId);

        const fromOwesTo = debts[from][to] || 0;
        const toOwesFrom = (debts[to] && debts[to][from]) || 0;

        const net = fromOwesTo - toOwesFrom;
        const roundedNet = Math.round(net * 100) / 100;

        if (roundedNet > 0) {
          rawDebts.push({ from, to, amount: roundedNet });
        } else if (roundedNet < 0) {
          rawDebts.push({ from: to, to: from, amount: Math.abs(roundedNet) });
        }
      });
    });

    return rawDebts;
  }

  // default: 'overall' logic (Debt simplification)
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
