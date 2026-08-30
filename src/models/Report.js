const { Schema, model } = require('mongoose');

const reportSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // ★ Flutter app එකෙන් හදන UUID එකක් — idempotency key
  clientReportId: { type: String, required: true },

  kind:  { type: String, enum: ['outage', 'restored'], default: 'outage' },
  type:  { type: String, enum: ['full_blackout', 'low_voltage', 'partial'], required: true },
  cause: { type: String, enum: ['transformer', 'storm', 'scheduled', 'line_down', 'unknown'], default: 'unknown' },

  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },   // ★ [lng, lat] — මේ පිළිවෙළ!
  },

  cellId:     { type: String, required: true, index: true },
  feederCode: { type: String, default: null },
  photoUrl:   { type: String, default: null },

  reportedAt: { type: Date, required: true },   // ★ DEVICE එකේ වෙලාව
  receivedAt: { type: Date, default: Date.now },// ★ SERVER එකට ආපු වෙලාව

  outage: { type: Schema.Types.ObjectId, ref: 'Outage', index: true },
  status: { type: String, enum: ['accepted', 'duplicate', 'rejected'], default: 'accepted' },
  weight: { type: Number, default: 1 },
}, { timestamps: true });

// ★ Idempotency — එකම user + එකම clientReportId දෙපාරක් බෑ. DB level එකේම block.
reportSchema.index({ user: 1, clientReportId: 1 }, { unique: true });

// Geo queries වලට
reportSchema.index({ location: '2dsphere' });

module.exports = model('Report', reportSchema);