const express = require('express');
const { getDirectMessages, sendDirectMessage } = require('../controllers/directMessageController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Mount auth middleware for all routes
router.use(protect);

router.route('/flat/:flatId/user/:userId')
  .get(getDirectMessages)
  .post(sendDirectMessage);

module.exports = router;
