const PersonalExpense = require('../models/PersonalExpense');
const DirectMessage = require('../models/DirectMessage');
const Flat = require('../models/Flat');

// @desc    Add a personal expense between two users
// @route   POST /api/personal-expenses/flat/:flatId/user/:userId
// @access  Private
const createPersonalExpense = async (req, res) => {
  try {
    const flatId = req.params.flatId;
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    // Verify user is part of the flat
    const flat = await Flat.findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });
    
    const isMember = flat.members.some(m => m.user.toString() === currentUserId.toString());
    const isTargetMember = flat.members.some(m => m.user.toString() === targetUserId.toString());
    
    if (!isMember || !isTargetMember) {
      return res.status(403).json({ success: false, error: 'Both users must be members of the flat' });
    }

    const { title, amount, category, splitType, date } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ success: false, error: 'Title and amount are required' });
    }

    // Default to equal split (each pays 50%) for simplicity in V1
    const totalAmount = Number(amount);
    const owedAmount = splitType === 'full' ? totalAmount : totalAmount / 2;

    const expense = await PersonalExpense.create({
      flat: flatId,
      title,
      amount: totalAmount,
      category: category || 'other',
      paidBy: currentUserId,
      owedBy: targetUserId,
      splitType: splitType || 'equal',
      owedAmount,
      date: date || Date.now(),
      createdBy: currentUserId
    });

    // Create a direct message system notification for this expense
    const messageContent = `Added expense: ${title} (₹${totalAmount})`;
    
    const message = await DirectMessage.create({
      flat: flatId,
      participants: [currentUserId, targetUserId],
      sender: currentUserId,
      content: messageContent,
      type: 'personal_expense_notification',
      relatedExpense: expense._id,
      readBy: [currentUserId]
    });

    const populatedMessage = await DirectMessage.findById(message._id)
      .populate('sender', 'name avatar')
      .populate('relatedExpense');

    res.status(201).json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error('Error creating personal expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createPersonalExpense
};
