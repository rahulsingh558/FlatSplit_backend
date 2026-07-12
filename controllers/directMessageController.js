const DirectMessage = require('../models/DirectMessage');
const Flat = require('../models/Flat');

// @desc    Get all direct messages between two users in a flat
// @route   GET /api/direct-messages/flat/:flatId/user/:userId
// @access  Private
const getDirectMessages = async (req, res) => {
  try {
    const flatId = req.params.flatId;
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;
    
    // Verify user is part of the flat
    const flat = await Flat.findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });
    
    const isMember = flat.members.some(m => m.user.toString() === currentUserId.toString());
    const isTargetMember = flat.members.some(m => m.user.toString() === targetUserId.toString());
    
    if (!isMember || !isTargetMember) {
      return res.status(403).json({ success: false, error: 'Both users must be members of the flat' });
    }

    // Fetch messages where participants are exactly the two users
    const messages = await DirectMessage.find({ 
      flat: flatId,
      participants: { $all: [currentUserId, targetUserId], $size: 2 }
    })
      .populate('sender', 'name avatar')
      .populate('relatedExpense')
      .sort({ createdAt: 1 })
      .limit(100);

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Send a direct text message
// @route   POST /api/direct-messages/flat/:flatId/user/:userId
// @access  Private
const sendDirectMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const flatId = req.params.flatId;
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!content) return res.status(400).json({ success: false, error: 'Message content is required' });

    // Verify user is part of the flat
    const flat = await Flat.findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });
    
    const isMember = flat.members.some(m => m.user.toString() === currentUserId.toString());
    const isTargetMember = flat.members.some(m => m.user.toString() === targetUserId.toString());
    
    if (!isMember || !isTargetMember) {
      return res.status(403).json({ success: false, error: 'Both users must be members of the flat' });
    }

    const message = await DirectMessage.create({
      flat: flatId,
      participants: [currentUserId, targetUserId],
      sender: currentUserId,
      content,
      type: 'text',
      readBy: [currentUserId]
    });

    const populatedMessage = await DirectMessage.findById(message._id).populate('sender', 'name avatar');

    res.status(201).json({ success: true, data: populatedMessage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getDirectMessages,
  sendDirectMessage
};
