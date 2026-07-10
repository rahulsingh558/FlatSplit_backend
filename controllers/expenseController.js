const Expense = require('../models/Expense');
const Message = require('../models/Message');
const Flat = require('../models/Flat');
const cloudinary = require('../config/cloudinary');
const calculateSplit = require('../utils/splitCalculator');

// Helper to upload buffer to cloudinary
const streamUpload = (buffer) => {
  return new Promise((resolve, reject) => {
    let stream = cloudinary.uploader.upload_stream(
      { 
        folder: 'flatsplit',
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

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
const createExpense = async (req, res) => {
  try {
    const { flatId, title, description, amount, category, splitType, selectedMembers, customAmounts, percentages, date } = req.body;
    
    // Parse JSON strings from form-data if present
    const parsedMembers = selectedMembers ? JSON.parse(selectedMembers) : [];
    const parsedCustom = customAmounts ? JSON.parse(customAmounts) : [];
    const parsedPercentages = percentages ? JSON.parse(percentages) : [];

    // Verify user is in flat
    const flat = await Flat.findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });
    
    const isMember = flat.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ success: false, error: 'Not authorized' });

    // Handle Image Upload
    let photos = [];
    if (req.file) {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name') {
        const result = await streamUpload(req.file.buffer);
        photos.push({
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    }

    // Calculate Split
    const splitAmong = calculateSplit(
      parseFloat(amount), 
      splitType, 
      parsedMembers.length > 0 ? parsedMembers : flat.members.map(m => m.user.toString()), 
      parsedCustom, 
      parsedPercentages
    );

    // Create Expense
    const expense = await Expense.create({
      flat: flatId,
      title,
      description,
      amount,
      category: category || 'other',
      paidBy: req.user._id,
      splitType,
      splitAmong,
      photos,
      date: date || Date.now(),
      createdBy: req.user._id
    });

    // Create corresponding Message for the Chat Feed
    const message = await Message.create({
      flat: flatId,
      sender: req.user._id,
      content: `${req.user.name.split(' ')[0]} added an expense: ${title}`,
      type: 'expense',
      relatedExpense: expense._id,
      readBy: [req.user._id]
    });

    // Populate the message to return to frontend
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar')
      .populate('relatedExpense');

    res.status(201).json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get all expenses for the current user's flats
// @route   GET /api/expenses/me
// @access  Private
const getMyExpenses = async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user._id).populate('flats');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const flatIds = user.flats.map(flat => flat._id);
    
    const expenses = await Expense.find({ flat: { $in: flatIds } })
      .populate('flat', 'name')
      .populate('paidBy', 'name avatar')
      .sort('-date');

    res.status(200).json({ success: true, count: expenses.length, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createExpense,
  getMyExpenses
};
