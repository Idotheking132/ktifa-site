const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Worker = require('../models/Worker');

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireMember(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.user.isMember && !req.user.isAdmin)
    return res.status(403).json({ error: 'No permission' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

// ─── WORKERS ──────────────────────────────────────────────────────────────────

router.get('/workers', requireMember, async (req, res) => {
  try {
    const workers = await Worker.find({ isActive: true });
    res.json(workers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/workers', requireAdmin, async (req, res) => {
  try {
    const workers = await Worker.find();
    res.json(workers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/workers', requireAdmin, async (req, res) => {
  try {
    const worker = new Worker(req.body);
    await worker.save();
    res.json(worker);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/workers/:id', requireAdmin, async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(worker);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/workers/:id', requireAdmin, async (req, res) => {
  try {
    await Worker.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────

// Get available time slots for a worker on a specific date
router.get('/workers/:workerId/slots', requireMember, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });

    const worker = await Worker.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const d = new Date(date);
    if (!worker.workDays.includes(d.getDay()))
      return res.json({ slots: [] });

    // Generate all time slots
    const allSlots = generateSlots(worker.startHour, worker.endHour, worker.slotDuration);

    // Get booked slots for this worker on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23,59,59,999);

    const booked = await Appointment.find({
      workerId: worker._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'rejected' }
    });

    const bookedTimes = booked.map(a => a.startTime);

    const slots = allSlots.map(s => ({
      startTime: s.start,
      endTime: s.end,
      available: !bookedTimes.includes(s.start)
    }));

    res.json({ slots, worker });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function generateSlots(startHour, endHour, duration) {
  const slots = [];
  let [sh, sm] = startHour.split(':').map(Number);
  const [eh, em] = endHour.split(':').map(Number);
  const endMins = eh * 60 + em;

  while (true) {
    const startMins = sh * 60 + sm;
    const endSlotMins = startMins + duration;
    if (endSlotMins > endMins) break;

    const start = `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`;
    const endH = Math.floor(endSlotMins / 60);
    const endM = endSlotMins % 60;
    const end = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;

    slots.push({ start, end });

    sm += duration;
    sh += Math.floor(sm / 60);
    sm = sm % 60;
  }
  return slots;
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

router.post('/appointments', requireMember, async (req, res) => {
  try {
    const { workerId, date, startTime, note } = req.body;

    const worker = await Worker.findById(workerId);
    if (!worker || !worker.isActive)
      return res.status(400).json({ error: 'Worker not available' });

    // Check day
    const d = new Date(date);
    if (!worker.workDays.includes(d.getDay()))
      return res.status(400).json({ error: 'Worker not available on this day' });

    // Calculate end time
    const [sh, sm] = startTime.split(':').map(Number);
    const endMins = sh * 60 + sm + worker.slotDuration;
    const endTime = `${String(Math.floor(endMins/60)).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`;

    // Check if slot is taken
    const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(date); endOfDay.setHours(23,59,59,999);

    const existing = await Appointment.findOne({
      workerId,
      date: { $gte: startOfDay, $lte: endOfDay },
      startTime,
      status: { $ne: 'rejected' }
    });
    if (existing) return res.status(400).json({ error: 'השעה הזו כבר תפוסה' });

    // Check user doesn't have appointment same time
    const userExisting = await Appointment.findOne({
      userId: req.user.id,
      date: { $gte: startOfDay, $lte: endOfDay },
      startTime,
      status: { $ne: 'rejected' }
    });
    if (userExisting) return res.status(400).json({ error: 'כבר יש לך תור בשעה הזו' });

    const appointment = new Appointment({
      userId: req.user.id,
      username: req.user.username,
      discriminator: req.user.discriminator,
      avatar: req.user.avatar,
      workerId,
      date: new Date(date),
      startTime,
      endTime,
      note: note || '',
      status: 'pending'
    });

    await appointment.save();

    try {
      const { sendApprovalRequest } = require('../bot');
      await sendApprovalRequest(appointment, worker);
    } catch (botErr) {
      console.error('Bot error:', botErr.message);
    }

    res.json({ success: true, appointment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/appointments/me', requireAuth, async (req, res) => {
  try {
    const appointments = await Appointment.find({ userId: req.user.id })
      .populate('workerId')
      .sort({ date: -1 });
    res.json(appointments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// All appointments - for schedule view
router.get('/appointments/schedule', requireMember, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const future = new Date(); future.setDate(future.getDate() + 7);

    const appointments = await Appointment.find({
      date: { $gte: today, $lte: future },
      status: { $ne: 'rejected' }
    }).populate('workerId').sort({ date: 1, startTime: 1 });

    res.json(appointments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/appointments', requireAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('workerId')
      .sort({ date: -1 });
    res.json(appointments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/appointments/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    ).populate('workerId');

    if (!appointment) return res.status(404).json({ error: 'Not found' });

    try {
      const { notifyUser } = require('../bot');
      await notifyUser(appointment);
    } catch (botErr) { console.error('Bot notify error:', botErr.message); }

    res.json({ success: true, appointment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
