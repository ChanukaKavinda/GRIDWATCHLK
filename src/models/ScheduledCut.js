const { Schema, model } = require('mongoose');

const scheduledCutSchema = new Schema({
  source:      { type: String, enum: ['CEB', 'LECO'], required: true },
  cellIds:     [{ type: String, index: true }],
  feederCodes: [{ type: String }],
  areaName:    { type: String, default: '' },
  startsAt:    { type: Date, required: true, index: true },
  endsAt:      { type: Date, required: true },
  noticeUrl:   { type: String, default: null },
  publishedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('ScheduledCut', scheduledCutSchema);