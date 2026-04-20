const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  discriminator: { type: String },
  avatar: { type: String },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  note: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  discordMessageId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
