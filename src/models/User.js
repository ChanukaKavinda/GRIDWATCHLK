const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  phone:        { type: String, required: true, unique: true, index: true },
  displayName:  { type: String, default: '' },
  areaLabel:    { type: String, default: '' },
  reputation:   { type: Number, default: 80, min: 0, max: 100 },
  role:         { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  isVerified:   { type: Boolean, default: false },
  deviceTokens: [{ type: String }],
  lastSeenAt:   { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('User', userSchema);