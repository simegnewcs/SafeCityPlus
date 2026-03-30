const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const upload = require('../middleware/uploadMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all incident routes
router.use(authMiddleware);

router.post('/', upload.single('image'), incidentController.reportIncident);
router.get('/', incidentController.getAllIncidents);
router.get('/user/:userId', incidentController.getIncidentsByUserId);
router.get('/:id', incidentController.getIncidentById);
router.put('/:id', incidentController.updateIncidentStatus);

module.exports = router;