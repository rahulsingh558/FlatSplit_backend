const Settlement = require('../models/Settlement');
const Expense = require('../models/Expense');
const Flat = require('../models/Flat');
const User = require('../models/User');
const Message = require('../models/Message');
const calculateBalances = require('../utils/balanceCalculator');
const cloudinary = require('../config/cloudinary');

// Helper to upload buffer to cloudinary
const streamUpload = (buffer) => {
  return new Promise((resolve, reject) => {
    let stream = cloudinary.uploader.upload_stream(
      { 
        folder: 'flatsplit_settlements',
        transformation: [
          { width: 1000, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
    const require_stream = require('stream');
    let str = new require_stream.Readable();
    str.push(buffer);
    str.push(null);
    str.pipe(stream);
  });
};

// @desc    Get simplified balances for a flat
// @route   GET /api/settlements/flat/:flatId/balances
// @access  Private
const getFlatBalances = async (req, res) => {
  try {
    const flatId = req.params.flatId;

    // Verify user is in flat
    const flat = await Flat.findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });
    
    const isMember = flat.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ success: false, error: 'Not authorized' });

    // Fetch all expenses and settlements
    const expenses = await Expense.find({ flat: flatId });
    const settlements = await Settlement.find({ flat: flatId });

    // Calculate simplified debts
    const debts = calculateBalances(expenses, settlements, flat.settlementType);

    // Populate user details for the debts
    // Collect unique user IDs
    const userIds = new Set();
    debts.forEach(d => {
      userIds.add(d.from);
      userIds.add(d.to);
    });

    const users = await User.find({ _id: { $in: Array.from(userIds) } }).select('name avatar upiId');
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u);

    // Format final response
    const formattedDebts = debts.map(d => ({
      from: userMap[d.from],
      to: userMap[d.to],
      amount: d.amount
    }));

    res.status(200).json({ success: true, data: formattedDebts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Record a settlement
// @route   POST /api/settlements/flat/:flatId
// @access  Private
const recordSettlement = async (req, res) => {
  try {
    const { toUserId, amount, method, isReceiverRecording } = req.body;
    const flatId = req.params.flatId;

    if (!toUserId || !amount) {
      return res.status(400).json({ success: false, error: 'Receiver and amount are required' });
    }

    // Verify user is in flat
    const flat = await Flat.findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });
    
    const isMember = flat.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ success: false, error: 'Not authorized' });

    let proofUrl = null;
    if (req.file) {
      const uploadResult = await streamUpload(req.file.buffer);
      proofUrl = uploadResult.secure_url;
    }

    const fromUserId = isReceiverRecording === 'true' ? toUserId : req.user._id;
    const actualToUserId = isReceiverRecording === 'true' ? req.user._id : toUserId;

    // Create Settlement
    const settlement = await Settlement.create({
      flat: flatId,
      from: fromUserId,
      to: actualToUserId,
      amount: parseFloat(amount),
      method: method || 'cash',
      proofOfPayment: proofUrl
    });

    // Fetch Other User Name
    const otherUser = await User.findById(toUserId).select('name');

    // Create corresponding Message for the Chat Feed
    const message = await Message.create({
      flat: flatId,
      sender: req.user._id,
      content: isReceiverRecording === 'true'
        ? `${req.user.name.split(' ')[0]} recorded a payment of ₹${amount} received from ${otherUser.name.split(' ')[0]}`
        : `${req.user.name.split(' ')[0]} paid ${otherUser.name.split(' ')[0]} ₹${amount}`,
      imageUrl: proofUrl,
      type: 'settlement',
      readBy: [req.user._id]
    });

    const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');

    res.status(201).json({ success: true, data: { settlement, message: populatedMessage } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getFlatBalances,
  recordSettlement
};
