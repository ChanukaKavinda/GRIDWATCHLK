const { Schema, model } = require('mongoose');

const eventSchema = new Schema({
  outage: { type: Schema.Types.ObjectId, ref: 'Outage', required: true, index: true },
  at:     { type: Date, required: true },
  type:   {
    type: String,
    enum: ['first_report', 'confirmed', 'crew_sighted', 'surge', 'restored'],
    required: true,
  },
  text:          { type: String, required: true },
  confirmations: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model('OutageEvent', eventSchema);