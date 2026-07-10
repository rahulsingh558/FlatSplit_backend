const Message = require('../models/Message');
const Flat = require('../models/Flat');

// @desc    Get all messages for a flat
// @route   GET /api/messages/flat/:flatId
// @access  Private
const getFlatMessages = async (req, res) => {
  try {
    const flatId = req.params.flatId;
    
    // Verify user is part of the flat
    const flat = await Flat.findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });
    
    const isMember = flat.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ success: false, error: 'Not authorized' });

    // Fetch messages (limit to last 50 for performance, ideally implement pagination)
    const messages = await Message.find({ flat: flatId })
      .populate('sender', 'name avatar')
      .populate('relatedExpense') // We will populate expense details when available
      .sort({ createdAt: 1 }) // Chronological order
      .limit(100);

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Send a text message to a flat
// @route   POST /api/messages/flat/:flatId
// @access  Private
const sendFlatMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const flatId = req.params.flatId;

    if (!content) return res.status(400).json({ success: false, error: 'Message content is required' });

    // Verify user is part of the flat
    const flat = await Flat.findById(flatId);
    if (!flat) return res.status(404).json({ success: false, error: 'Flat not found' });
    
    const isMember = flat.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ success: false, error: 'Not authorized' });

    const message = await Message.create({
      flat: flatId,
      sender: req.user._id,
      content,
      type: 'text',
      readBy: [req.user._id]
    });

    const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');

    res.status(201).json({ success: true, data: populatedMessage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getFlatMessages,
  sendFlatMessage
};
