const express = require('express');
const { requestVerification, verifyCode, login } = require('../controllers/authController');
const router = express.Router();

router.post('/request-verification', requestVerification);
router.post('/verify-code', verifyCode);
router.post('/login', login);

module.exports = router;
