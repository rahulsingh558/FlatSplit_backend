const mongoose = require('mongoose');

const personalSettlementSchema = new mongoose.Schema({
  flat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flat',
    required: true
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'other'],
    default: 'upi'
  },
  note: {
    type: String
  },
  scope: {
    type: String,
    enum: ['personal'],
    default: 'personal'
  }
}, { timestamps: true });

module.exports = mongoose.model('PersonalSettlement', personalSettlementSchema);
