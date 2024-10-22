const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // שליחת מיילים
const cors = require('cors'); // הוספת cors
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret';
const rateLimit = require('express-rate-limit'); // להגבלת מספר שליחת הקודים


// הגדרת שירות שליחת מיילים עם nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'royinagar2@gmail.com', // הכנס את המייל שלך
    pass: 'pryk uqde apyp kuwl',  // הכנס את הסיסמה שלך
  },
});


// אפשר cors מכל המקורות או התאמה למקור של React Native
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); // שימוש ב-cors
app.use(express.json());

// MongoDB URL
const mongoUri = 'mongodb://localhost:27017/appointmentApp';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = require('./models/User'); // ייבוא המודל מהקובץ models/User.js

// משתמש זמני כדי לאחסן את פרטי המשתמש עד לאימות
let temporaryUser = null;
let verificationCode = null;
let verificationExpiryTime = null;

// Middleware להגבלת שליחת קודים (3 שליחות בדקה)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 דקה
  max: 3, // עד 3 שליחות לדקה
});

// פונקציה ליצירת קוד אימות
const generateVerificationCode = () => Math.floor(10000 + Math.random() * 90000).toString();

// שליחת קוד אימות למייל
const sendVerificationEmail = (email, code) => {
  const mailOptions = {
    from: 'your-email@gmail.com',
    to: email,
    subject: 'Verify your account',
    text: `Your verification code is: ${code}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};

// שליחת קוד למייל ושמירת משתמש זמני
app.post('/api/request-verification', limiter, async (req, res) => {
  const { username, email, password } = req.body;

  // יצירת קוד אימות ושמירתו
  verificationCode = generateVerificationCode();
  verificationExpiryTime = Date.now() + 60 * 1000; // זמן תוקף של דקה אחת

  // שמירת פרטי משתמש זמני
  temporaryUser = {
    username,
    email,
    password: await bcrypt.hash(password, 10),
  };

  // שליחת קוד למייל
  sendVerificationEmail(email, verificationCode);

  return res.status(200).json({ success: true, message: 'Verification code sent to email' });
});

// אימות קוד
app.post('/api/verify-code', async (req, res) => {
  const { email, code } = req.body;

  // בדיקת תוקף קוד האימות
  if (Date.now() > verificationExpiryTime) {
    return res.status(400).json({ success: false, message: 'Verification code expired' });
  }

  // בדיקת קוד
  if (code === verificationCode) {
    // יצירת המשתמש בבסיס הנתונים רק לאחר שהקוד תקין
    const user = new User({
      username: temporaryUser.username,
      email: temporaryUser.email,
      password: temporaryUser.password,
    });

    await user.save();

    // אפס את המשתמש הזמני והקוד
    temporaryUser = null;
    verificationCode = null;
    verificationExpiryTime = null;

    return res.status(201).json({ success: true, message: 'User verified and registered' });
  } else {
    return res.status(400).json({ success: false, message: 'Invalid verification code' });
  }
});

// שליחה חוזרת של קוד אימות במידה והקוד פג תוקף
app.post('/api/resend-code', limiter, (req, res) => {
  const { email } = req.body;

  if (!temporaryUser || temporaryUser.email !== email) {
    return res.status(400).json({ success: false, message: 'User not found' });
  }

  // יצירת קוד חדש ושליחתו
  verificationCode = generateVerificationCode();
  verificationExpiryTime = Date.now() + 60 * 1000; // זמן תוקף חדש

  sendVerificationEmail(email, verificationCode);

  return res.status(200).json({ success: true, message: 'New verification code sent' });
});

// התחברות משתמש קיים
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid username or password' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ success: false, message: 'Invalid username or password' });
  }

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ success: true, token, message: 'Login successful' });
});

// Middleware לאימות משתמש
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// נתיב לקבלת נתוני פרופיל המשתמש
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password'); // הסרת הסיסמה מהתשובה

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      name: `${user.firstName}`,
      location: user.location,
      bio: user.bio,
      profileImageUrl: user.profileImageUrl,
      trips: user.trips,
      rating: user.rating,
      reviews: user.reviews,
    });
    console.log(user.firstName);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching profile data' });
  }
});

// הפעלת השרת
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
