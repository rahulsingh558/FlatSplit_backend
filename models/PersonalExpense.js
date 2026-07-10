const mongoose = require('mongoose');

const personalExpenseSchema = new mongoose.Schema({
  flat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flat',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['food', 'transport', 'shopping', 'lending', 'other'],
    required: true
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  owedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  splitType: {
    type: String,
    enum: ['equal', 'full', 'custom'],
    default: 'equal'
  },
  owedAmount: {
    type: Number,
    required: true
  },
  settled: {
    type: Boolean,
    default: false
  },
  photos: [{
    url: String,
    publicId: String
  }],
  date: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('PersonalExpense', personalExpenseSchema);
