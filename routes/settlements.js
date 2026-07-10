const express = require('express');
const { getFlatBalances, recordSettlement } = require('../controllers/settlementController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload'); // Import multer

const router = express.Router();

// Mount auth middleware for all routes
router.use(protect);

router.route('/flat/:flatId/balances')
  .get(getFlatBalances);

router.route('/flat/:flatId')
  .post(upload.single('proof'), recordSettlement);

module.exports = router;
