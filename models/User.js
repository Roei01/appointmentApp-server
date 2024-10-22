// models/User.js
const mongoose = require('mongoose');

// הגדרת סכמה של המשתמשים
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  firstName: { type: String, default: '' }, // שדה לא-חובה עם ערך ברירת מחדל
  lastName: { type: String, default: '' },  // שדה לא-חובה עם ערך ברירת מחדל
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  location: { type: String, default: 'Not specified' }, // אפשרות להוסיף מיקום כברירת מחדל
  bio: { type: String, default: 'No bio available' },   // אפשרות להוסיף ביוגרפיה כברירת מחדל
  trips: { type: Number, default: 0 },    // ערך ברירת מחדל 0 עבור מספר טיולים
  rating: { type: Number, default: 0 },   // ערך ברירת מחדל 0 עבור דירוג
  reviews: { type: Number, default: 0 },  // ערך ברירת מחדל 0 עבור ביקורות
  profileImageUrl: { 
    type: String, 
    default: 'https://example.com/default-profile-image.png' // תמונת פרופיל ברירת מחדל
  }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
