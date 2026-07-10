const express = require('express');
const { getFlatMessages, sendFlatMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Mount auth middleware for all routes
router.use(protect);

router.route('/flat/:flatId')
  .get(getFlatMessages)
  .post(sendFlatMessage);

module.exports = router;
