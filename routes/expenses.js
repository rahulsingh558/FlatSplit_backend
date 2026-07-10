const express = require('express');
const { createExpense, getMyExpenses } = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Mount auth middleware for all routes
router.use(protect);

router.route('/me').get(getMyExpenses);

router.route('/')
  .post(upload.single('receipt'), createExpense);

module.exports = router;
