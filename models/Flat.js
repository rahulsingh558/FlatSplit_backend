const mongoose = require('mongoose');

const flatSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  settlementType: {
    type: String,
    enum: ['one-to-one', 'overall'],
    default: 'overall'
  }
}, { timestamps: true });

module.exports = mongoose.model('Flat', flatSchema);
