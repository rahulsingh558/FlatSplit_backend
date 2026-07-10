const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  avatar: {
    type: String
  },
  phone: {
    type: String
  },
  upiId: {
    type: String
  },
  flats: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flat'
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
