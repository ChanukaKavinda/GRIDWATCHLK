const { Schema, model } = require('mongoose');

const outageSchema = new Schema({
  cellId:     { type: String, required: true, index: true },
  cellLabel:  { type: String, default: '' },
  areaName:   { type: String, default: '' },
  feederCode: { type: String, default: null, index: true },

  centroid: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },

  status: {
    type: String,
    enum: ['reported', 'confirmed', 'restored', 'rejected'],
    default: 'reported',
    index: true,
  },

  startedAt:   { type: Date, required: true },
  confirmedAt: { type: Date, default: null },
  restoredAt:  { type: Date, default: null },
  durationMins:{ type: Number, default: null },   // ★ restore වෙනකොට එක පාරක් ගණන් හදනවා

  reportCount:     { type: Number, default: 0 },
  uniqueUserCount: { type: Number, default: 0 },  // ★ ඇත්ත trust signal එක

  dominantCause: { type: String, default: 'unknown' },
  trustScore:    { type: Number, default: 0 },
  autoClosed:    { type: Boolean, default: false },
}, { timestamps: true });

outageSchema.index({ centroid: '2dsphere' });
outageSchema.index({ status: 1, startedAt: -1 });   // map queries වලට

module.exports = model('Outage', outageSchema);