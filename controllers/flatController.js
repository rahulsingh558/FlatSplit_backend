const Flat = require('../models/Flat');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Message = require('../models/Message');
const Settlement = require('../models/Settlement');
const generateInviteCode = require('../utils/generateInviteCode');

// @desc    Create new flat
// @route   POST /api/flats
// @access  Private
const createFlat = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Please add a name for the flat' });
    }

    let inviteCode;
    let isUnique = false;

    // Ensure unique invite code
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const existing = await Flat.findOne({ inviteCode });
      if (!existing) isUnique = true;
    }

    const flat = await Flat.create({
      name,
      inviteCode,
      members: [{ user: req.user._id, role: 'admin' }],
      createdBy: req.user._id
    });

    // Add flat to user's flats array
    await User.findByIdAndUpdate(req.user._id, { $push: { flats: flat._id } });

    res.status(201).json({ success: true, data: flat });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Join a flat
// @route   POST /api/flats/join
// @access  Private
const joinFlat = async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Please provide an invite code' });
    }

    const flat = await Flat.findOne({ inviteCode });

    if (!flat) {
      return res.status(404).json({ success: false, error: 'Invalid invite code' });
    }

    // Check if user is already a member
    const isMember = flat.members.some(member => member.user.toString() === req.user._id.toString());

    if (isMember) {
      return res.status(400).json({ success: false, error: 'You are already a member of this flat' });
    }

    // Add user to flat
    flat.members.push({ user: req.user._id, role: 'member' });
    await flat.save();

    // Add flat to user
    await User.findByIdAndUpdate(req.user._id, { $push: { flats: flat._id } });

    res.status(200).json({ success: true, data: flat });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get flat details
// @route   GET /api/flats/:id
// @access  Private
const getFlat = async (req, res) => {
  try {
    const flat = await Flat.findById(req.params.id)
      .populate('members.user', 'name email avatar upiId')
      .populate('createdBy', 'name');

    if (!flat) {
      return res.status(404).json({ success: false, error: 'Flat not found' });
    }

    // Verify user is a member
    const isMember = flat.members.some(member => member.user._id.toString() === req.user._id.toString());
    
    if (!isMember) {
      return res.status(401).json({ success: false, error: 'Not authorized to view this flat' });
    }

    res.status(200).json({ success: true, data: flat });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get user's flats
// @route   GET /api/flats
// @access  Private
const getMyFlats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'flats',
      select: '_id name inviteCode members',
      populate: { path: 'members.user', select: '_id name avatar upiId' }
    });

    res.status(200).json({ success: true, data: user.flats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update a flat
// @route   PUT /api/flats/:id
// @access  Private
const updateFlat = async (req, res) => {
  try {
    const { name, settlementType } = req.body;
    const flat = await Flat.findById(req.params.id);

    if (!flat) {
      return res.status(404).json({ success: false, error: 'Flat not found' });
    }

    // Verify user is the creator or an admin
    const isCreator = flat.createdBy.toString() === req.user._id.toString();
    const isAdmin = flat.members.some(member => 
      member.user.toString() === req.user._id.toString() && member.role === 'admin'
    );
    
    if (!isCreator && !isAdmin) {
      return res.status(401).json({ success: false, error: 'Not authorized to update this flat' });
    }

    if (name) flat.name = name;
    if (settlementType) flat.settlementType = settlementType;
    await flat.save();

    res.status(200).json({ success: true, data: flat });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Delete a flat
// @route   DELETE /api/flats/:id
// @access  Private
const deleteFlat = async (req, res) => {
  try {
    const flat = await Flat.findById(req.params.id);

    if (!flat) {
      return res.status(404).json({ success: false, error: 'Flat not found' });
    }

    // Verify user is the creator
    if (flat.createdBy.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, error: 'Only the creator can delete the flat' });
    }

    // Remove flat ID from all users' flats array
    await User.updateMany(
      { flats: flat._id },
      { $pull: { flats: flat._id } }
    );

    // Cascading deletes for related data
    await Expense.deleteMany({ flat: flat._id });
    await Message.deleteMany({ flat: flat._id });
    await Settlement.deleteMany({ flat: flat._id });
    
    // Also delete personal expenses and direct messages if they exist
    const PersonalExpense = require('../models/PersonalExpense');
    const DirectMessage = require('../models/DirectMessage');
    const PersonalSettlement = require('../models/PersonalSettlement');
    
    await PersonalExpense.deleteMany({ flat: flat._id });
    await DirectMessage.deleteMany({ flat: flat._id });
    await PersonalSettlement.deleteMany({ flat: flat._id });

    await flat.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Add member to flat manually by email
// @route   POST /api/flats/:id/members
// @access  Private
const addMember = async (req, res) => {
  try {
    const { email } = req.body;
    const flat = await Flat.findById(req.params.id);

    if (!flat) {
      return res.status(404).json({ success: false, error: 'Flat not found' });
    }

    // Verify user is the creator or an admin
    const isCreator = flat.createdBy.toString() === req.user._id.toString();
    const isAdmin = flat.members.some(member => 
      member.user.toString() === req.user._id.toString() && member.role === 'admin'
    );
    
    if (!isCreator && !isAdmin) {
      return res.status(401).json({ success: false, error: 'Not authorized to add members' });
    }

    const userToAdd = await User.findOne({ email });
    if (!userToAdd) {
      return res.status(404).json({ success: false, error: 'User with this email not found' });
    }

    const isMember = flat.members.some(member => member.user.toString() === userToAdd._id.toString());
    if (isMember) {
      return res.status(400).json({ success: false, error: 'User is already a member' });
    }

    flat.members.push({ user: userToAdd._id, role: 'member' });
    await flat.save();

    await User.findByIdAndUpdate(userToAdd._id, { $push: { flats: flat._id } });

    res.status(200).json({ success: true, data: flat });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Remove member from flat
// @route   DELETE /api/flats/:id/members/:userId
// @access  Private
const removeMember = async (req, res) => {
  try {
    const flat = await Flat.findById(req.params.id);
    const userIdToRemove = req.params.userId;

    if (!flat) {
      return res.status(404).json({ success: false, error: 'Flat not found' });
    }

    // Verify user is the creator or an admin
    const isCreator = flat.createdBy.toString() === req.user._id.toString();
    const isAdmin = flat.members.some(member => 
      member.user.toString() === req.user._id.toString() && member.role === 'admin'
    );
    
    if (!isCreator && !isAdmin) {
      return res.status(401).json({ success: false, error: 'Not authorized to remove members' });
    }

    // Cannot remove the creator
    if (flat.createdBy.toString() === userIdToRemove) {
      return res.status(400).json({ success: false, error: 'Cannot remove the creator of the group' });
    }

    const isMember = flat.members.some(member => member.user.toString() === userIdToRemove);
    if (!isMember) {
      return res.status(400).json({ success: false, error: 'User is not a member of this group' });
    }

    // Remove user from flat members
    flat.members = flat.members.filter(member => member.user.toString() !== userIdToRemove);
    await flat.save();

    // Remove flat from user's flats list
    await User.findByIdAndUpdate(userIdToRemove, { $pull: { flats: flat._id } });

    res.status(200).json({ success: true, data: flat });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createFlat,
  joinFlat,
  getFlat,
  getMyFlats,
  updateFlat,
  deleteFlat,
  addMember,
  removeMember
};
