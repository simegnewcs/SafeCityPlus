const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const upload = require('../middleware/uploadMiddleware');

router.post('/', upload.single('image'), incidentController.reportIncident);
router.get('/', incidentController.getAllIncidents);

module.exports = router;