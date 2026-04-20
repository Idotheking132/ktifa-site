const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: '#6366f1' }, // display color
  workDays: { type: [Number], default: [0,1,2,3,4,5,6] }, // 0=Sun
  startHour: { type: String, default: '09:00' },
  endHour: { type: String, default: '18:00' },
  slotDuration: { type: Number, default: 30 }, // minutes: 30, 60, 90, 120
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Worker', workerSchema);
