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
        // Cloudinary upload
        const result = await streamUpload(req.file.buffer);
        photos.push({
          url: result.secure_url,
          publicId: result.public_id
        });
      } else {
        // Local file upload fallback
        const fs = require('fs');
        const path = require('path');
        const sharp = require('sharp');
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'receipts');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const filepath = path.join(uploadsDir, filename);
        
        await sharp(req.file.buffer)
          .resize({ width: 1080, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(filepath);
        
        const baseUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace('https://', 'https://') : `http://localhost:${process.env.PORT || 5000}`;
        const serverUrl = `${process.env.NODE_ENV === 'production' ? (process.env.CLIENT_URL || 'http://localhost:5000') : 'http://localhost:5000'}`;
        // Serve from backend static path
        photos.push({
          url: `/uploads/receipts/${filename}`,
          publicId: filename
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

// @desc    Update an expense (title, amount, category, date)
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });

    // Only creator can edit
    if (expense.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the creator can edit this expense' });
    }

    const { title, amount, category, date, splitType, selectedMembers, customAmounts, percentages } = req.body;

    if (title) expense.title = title;
    if (category) expense.category = category;
    if (date) expense.date = date;
    if (amount) expense.amount = Number(amount);
    
    // Parse JSON strings from form-data if present
    let parsedMembers = [];
    let parsedCustom = [];
    let parsedPercentages = [];
    
    if (selectedMembers) parsedMembers = JSON.parse(selectedMembers);
    if (customAmounts) parsedCustom = JSON.parse(customAmounts);
    if (percentages) parsedPercentages = JSON.parse(percentages);

    if (splitType) {
      expense.splitType = splitType;
      
      const flat = await Flat.findById(expense.flat);
      
      expense.splitAmong = calculateSplit(
        expense.amount,
        splitType,
        parsedMembers.length > 0 ? parsedMembers : flat.members.map(m => m.user.toString()),
        parsedCustom,
        parsedPercentages
      );
    }

    // Handle Image Re-upload
    if (req.file) {
      let newPhotos = [];
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name') {
        const result = await streamUpload(req.file.buffer);
        newPhotos.push({
          url: result.secure_url,
          publicId: result.public_id
        });
      } else {
        const fs = require('fs');
        const path = require('path');
        const sharp = require('sharp');
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'receipts');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const filepath = path.join(uploadsDir, filename);
        
        await sharp(req.file.buffer)
          .resize({ width: 1080, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(filepath);
        
        newPhotos.push({
          url: `/uploads/receipts/${filename}`,
          publicId: filename
        });
      }
      expense.photos = newPhotos;
    }

    await expense.save();

    res.status(200).json({ success: true, data: expense });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Close/reopen an expense
// @route   PUT /api/expenses/:id/status
// @access  Private
const closeExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });

    // Only creator can close/reopen
    if (expense.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the creator can close this expense' });
    }

    const { status } = req.body;
    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be open or closed' });
    }

    expense.status = status;
    await expense.save();

    res.status(200).json({ success: true, data: expense });
  } catch (error) {
    console.error('Error closing expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createExpense,
  getMyExpenses,
  updateExpense,
  closeExpense
};
