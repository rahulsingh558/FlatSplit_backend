const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
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
  proofOfPayment: {
    type: String // URL from Cloudinary
  },
  note: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Settlement', settlementSchema);
