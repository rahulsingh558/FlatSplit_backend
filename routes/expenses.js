const express = require('express');
const { createExpense, getMyExpenses, updateExpense, closeExpense, getExpensesBetweenUsers, requestDeleteExpense, respondDeleteExpense, parseReceiptImage } = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Mount auth middleware for all routes
router.use(protect);

router.route('/me').get(getMyExpenses);

router.route('/flat/:flatId/between/:userId').get(getExpensesBetweenUsers);

router.route('/parse-receipt')
  .post(upload.single('receipt'), parseReceiptImage);

router.route('/')
  .post(upload.single('receipt'), createExpense);

router.route('/:id')
  .put(upload.single('receipt'), updateExpense);

router.route('/:id/status')
  .put(closeExpense);

router.route('/:id')
  .delete(requestDeleteExpense);

router.route('/:id/delete-response')
  .post(respondDeleteExpense);

module.exports = router;
