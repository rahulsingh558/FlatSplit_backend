const express = require('express');
const { createExpense, getMyExpenses, updateExpense, closeExpense } = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Mount auth middleware for all routes
router.use(protect);

router.route('/me').get(getMyExpenses);

router.route('/')
  .post(upload.single('receipt'), createExpense);

router.route('/:id')
  .put(upload.single('receipt'), updateExpense);

router.route('/:id/status')
  .put(closeExpense);

module.exports = router;
