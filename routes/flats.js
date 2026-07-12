const express = require('express');
const { createFlat, joinFlat, getFlat, getMyFlats, updateFlat, deleteFlat } = require('../controllers/flatController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Mount auth middleware for all routes
router.use(protect);

router.route('/')
  .get(getMyFlats)
  .post(createFlat);

router.post('/join', joinFlat);

router.route('/:id')
  .get(getFlat)
  .put(updateFlat)
  .delete(deleteFlat);

module.exports = router;
