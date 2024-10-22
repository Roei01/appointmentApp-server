const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = 'your_jwt_secret';
const sendVerificationEmail = require('../config/emailService'); // פונקציית שליחת מייל

let temporaryUser = null;
let verificationCode = null;
let verificationExpiryTime = null;

const generateVerificationCode = () => Math.floor(10000 + Math.random() * 90000).toString();

exports.requestVerification = async (req, res) => {
    const { username, email, password } = req.body;
  
    try {
      // בדוק אם שם המשתמש כבר קיים
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ success: false, message: 'Username is already taken' });
      }
  
      // בדוק אם האימייל כבר קיים
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email is already registered' });
      }
  
      // אם שם המשתמש והאימייל ייחודיים, המשך ביצירת קוד אימות
      verificationCode = generateVerificationCode();
      verificationExpiryTime = Date.now() + 60 * 1000;
  
      // הצפן את הסיסמה ושמור את פרטי המשתמש הזמני
      temporaryUser = {
        username,
        email,
        password: await bcrypt.hash(password, 10),
      };
  
      // שלח את קוד האימות למייל
      sendVerificationEmail(email, verificationCode);
  
      // החזר תשובה ללקוח שהקוד נשלח בהצלחה
      return res.status(200).json({ success: true, message: 'Verification code sent to email' });
  
    } catch (error) {
      console.error('Error in requestVerification:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
  
exports.verifyCode = async (req, res) => {
  const { email, code } = req.body;

  if (Date.now() > verificationExpiryTime) {
    return res.status(400).json({ success: false, message: 'Verification code expired' });
  }

  if (code === verificationCode) {
    const user = new User(temporaryUser);
    await user.save();

    temporaryUser = null;
    verificationCode = null;
    verificationExpiryTime = null;

    res.status(201).json({ success: true, message: 'User verified and registered' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid verification code' });
  }
};

exports.login = async (req, res) => {
  const { email, password, loginWithEmailOnly } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid email' });
  }

  // אם המשתמש בוחר התחברות עם מייל בלבד, לא נדרוש סיסמה
  if (!loginWithEmailOnly && !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ success: false, message: 'Invalid password' });
  }

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ success: true, token, message: 'Login successful' });
};

exports.requestMagicLink = async (req, res) => {
  const { email } = req.body;

  let user = await User.findOne({ email });
  
  // אם המשתמש לא קיים, צור אותו (למקרה שאין רישום)
  if (!user) {
    user = new User({ email });
    await user.save();
  }

  // יצירת טוקן עבור ה-Magic Link
  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '15m' });

  const magicLinkUrl = `http://yourapp.com/magic-link?token=${token}`; // קישור magic-link בצד הלקוח

  // שליחת מייל
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Magic Link for Login',
    text: `Click the following link to login: ${magicLinkUrl}`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
      return res.status(500).json({ success: false, message: 'Failed to send magic link' });
    }
    res.json({ success: true, message: 'Magic link sent successfully' });
  });
};  
