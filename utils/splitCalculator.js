const calculateSplit = (amount, splitType, members, customAmounts = [], percentages = []) => {
  let splitAmong = [];
  
  if (splitType === 'equal') {
    const splitAmount = parseFloat((amount / members.length).toFixed(2));
    
    // Handle precision issues by adding remainder to the first person
    const totalSplit = splitAmount * members.length;
    const difference = parseFloat((amount - totalSplit).toFixed(2));
    
    splitAmong = members.map((userId, index) => ({
      user: userId,
      amount: index === 0 ? splitAmount + difference : splitAmount,
      settled: false
    }));
  } 
  else if (splitType === 'custom') {
    // customAmounts should be an array of { user, amount }
    splitAmong = customAmounts.map(item => ({
      user: item.user,
      amount: parseFloat(item.amount),
      settled: false
    }));
  }
  else if (splitType === 'percentage') {
    // percentages should be an array of { user, percentage }
    splitAmong = percentages.map(item => ({
      user: item.user,
      amount: parseFloat(((amount * item.percentage) / 100).toFixed(2)),
      settled: false
    }));
  }

  return splitAmong;
};

module.exports = calculateSplit;
