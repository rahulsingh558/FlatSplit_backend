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

// @desc    Get expenses between current user and another user in a flat
// @route   GET /api/expenses/flat/:flatId/between/:userId
// @access  Private
const getExpensesBetweenUsers = async (req, res) => {
  try {
    const { flatId, userId: targetUserId } = req.params;
    const currentUserId = req.user._id;

    // Verify user is in flat
    const flat = await require('../models/Flat').findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });

    const isMember = flat.members.some(m => m.user.toString() === currentUserId.toString());
    if (!isMember) return res.status(403).json({ success: false, error: 'Not authorized' });

    // Find group expenses in this flat where both users are part of splitAmong
    const expenses = await Expense.find({
      flat: flatId,
      'splitAmong.user': { $all: [currentUserId, targetUserId] }
    })
      .populate('paidBy', 'name avatar')
      .populate('flat', 'name')
      .sort('-date');

    // Also get personal expenses between these two users
    const PersonalExpense = require('../models/PersonalExpense');
    const personalExpenses = await PersonalExpense.find({
      flat: flatId,
      $or: [
        { paidBy: currentUserId, owedBy: targetUserId },
        { paidBy: targetUserId, owedBy: currentUserId }
      ]
    })
      .populate('paidBy', 'name avatar')
      .populate('owedBy', 'name avatar')
      .sort('-date');

    res.status(200).json({
      success: true,
      data: {
        groupExpenses: expenses,
        personalExpenses: personalExpenses
      }
    });
  } catch (error) {
    console.error('Error getting expenses between users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Request to delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
const requestDeleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });

    const flat = await Flat.findById(expense.flat);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });

    const userId = req.user._id.toString();
    const creatorId = expense.createdBy.toString();
    
    // Find the flat admin
    const adminMember = flat.members.find(m => m.role === 'admin');
    const adminId = adminMember ? adminMember.user.toString() : null;

    if (userId !== creatorId && userId !== adminId) {
      return res.status(403).json({ success: false, error: 'Only the creator or admin can delete this expense' });
    }

    // If user is both creator and admin, or if there is no admin
    if ((userId === creatorId && userId === adminId) || !adminId) {
      await Message.findOneAndDelete({ relatedExpense: expense._id });
      await expense.deleteOne();
      
      const io = req.app.get('io');
      if (io) {
        io.to(flat._id.toString()).emit('expenseDeleted', expense._id);
      }
      return res.status(200).json({ success: true, message: 'Expense deleted' });
    }

    // Determine who needs to authorize
    const needsAuthFrom = (userId === creatorId) ? adminId : creatorId;

    expense.deleteRequest = {
      requestedBy: req.user._id,
      status: 'pending'
    };
    await expense.save();

    const populatedExpense = await Expense.findById(expense._id)
      .populate('createdBy', 'name')
      .populate('deleteRequest.requestedBy', 'name');

    // Notify the other party via socket
    const io = req.app.get('io');
    if (io) {
      io.to(flat._id.toString()).emit('deleteExpenseRequest', {
        expense: populatedExpense,
        requester: req.user.name,
        needsAuthFrom: needsAuthFrom
      });
      io.to(flat._id.toString()).emit('expenseUpdated', populatedExpense);
    }

    res.status(200).json({ success: true, message: 'Deletion request sent', data: expense });
  } catch (error) {
    console.error('Error requesting delete expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Approve or reject expense deletion
// @route   POST /api/expenses/:id/delete-response
// @access  Private
const respondDeleteExpense = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const expense = await Expense.findById(req.params.id)
      .populate('deleteRequest.requestedBy', 'name');
      
    if (!expense || !expense.deleteRequest || expense.deleteRequest.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'No pending deletion request found' });
    }

    const flat = await Flat.findById(expense.flat);
    const userId = req.user._id.toString();
    const creatorId = expense.createdBy.toString();
    const adminMember = flat.members.find(m => m.role === 'admin');
    const adminId = adminMember ? adminMember.user.toString() : null;

    const requesterId = expense.deleteRequest.requestedBy._id.toString();
    const authorizedResponderId = (requesterId === creatorId) ? adminId : creatorId;

    if (userId !== authorizedResponderId) {
      return res.status(403).json({ success: false, error: 'You are not authorized to respond to this request' });
    }

    const io = req.app.get('io');

    if (action === 'approve') {
      await Message.findOneAndDelete({ relatedExpense: expense._id });
      await expense.deleteOne();
      
      if (io) {
        io.to(flat._id.toString()).emit('expenseDeleted', expense._id);
      }
      return res.status(200).json({ success: true, message: 'Expense deleted' });
    } else {
      expense.deleteRequest.status = 'rejected';
      await expense.save();
      
      if (io) {
        io.to(flat._id.toString()).emit('deleteExpenseRejected', {
          expenseId: expense._id,
          rejectedBy: req.user.name,
          requestedBy: requesterId
        });
        
        const populatedExpense = await Expense.findById(expense._id);
        io.to(flat._id.toString()).emit('expenseUpdated', populatedExpense);
      }
      return res.status(200).json({ success: true, message: 'Deletion request rejected' });
    }
  } catch (error) {
    console.error('Error responding to delete expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createExpense,
  getMyExpenses,
  updateExpense,
  closeExpense,
  getExpensesBetweenUsers,
  requestDeleteExpense,
  respondDeleteExpense
};
