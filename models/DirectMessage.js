const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  flat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flat',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }], // Always exactly 2 users
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'personal_expense_notification', 'personal_settlement_notification'],
    default: 'text'
  },
  relatedExpense: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalExpense'
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

// Ensure exactly two participants
directMessageSchema.path('participants').validate(function (value) {
  return value.length === 2;
}, 'Direct message must have exactly 2 participants.');

module.exports = mongoose.model('DirectMessage', directMessageSchema);
