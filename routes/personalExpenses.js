const express = require('express');
const { createPersonalExpense } = require('../controllers/personalExpenseController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Mount auth middleware for all routes
router.use(protect);

router.route('/flat/:flatId/user/:userId')
  .post(createPersonalExpense);

module.exports = router;
