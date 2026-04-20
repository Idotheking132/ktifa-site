require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

const APPROVAL_CHANNEL_ID = process.env.APPROVAL_CHANNEL_ID;

// Connect MongoDB only if running standalone (not via server.js)
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/katifa')
    .then(() => console.log('✅ Bot: MongoDB connected'))
    .catch(err => console.error('❌ Bot MongoDB error:', err));
}

const Appointment = require('./models/Appointment');
const Worker = require('./models/Worker');

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
});

// ─── Handle button interactions ───────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, appointmentId] = interaction.customId.split('_');

  if (action !== 'approve' && action !== 'reject') return;

  try {
    const appointment = await Appointment.findById(appointmentId).populate('workerId');
    if (!appointment) {
      return interaction.reply({ content: '❌ לא נמצאה הבקשה.', ephemeral: true });
    }

    if (appointment.status !== 'pending') {
      return interaction.reply({ content: '⚠️ הבקשה כבר טופלה.', ephemeral: true });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    appointment.status = newStatus;
    await appointment.save();

    // Update embed
    const updatedEmbed = buildEmbed(appointment, newStatus);
    await interaction.update({ embeds: [updatedEmbed], components: [] });

    // DM the user
    await dmUser(appointment, newStatus);

  } catch (err) {
    console.error('Button interaction error:', err);
    try {
      await interaction.reply({ content: '❌ שגיאה בעיבוד הבקשה.', ephemeral: true });
    } catch (replyErr) {
      console.error('Failed to send error reply:', replyErr);
    }
  }
});

// ─── Build embed ──────────────────────────────────────────────────────────────
function buildEmbed(appointment, status = 'pending') {
  const statusColors = { pending: 0xF5A623, approved: 0x2ECC71, rejected: 0xE74C3C };
  const statusLabels = { pending: '⏳ ממתין לאישור', approved: '✅ אושר', rejected: '❌ נדחה' };

  const dateStr = new Date(appointment.date).toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const avatarUrl = appointment.avatar
    ? `https://cdn.discordapp.com/avatars/${appointment.userId}/${appointment.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const workerName = appointment.workerId?.name || 'לא ידוע';

  return new EmbedBuilder()
    .setTitle('✂️ בקשת תור - Ido & Jonathan Shop')
    .setColor(statusColors[status])
    .setThumbnail(avatarUrl)
    .addFields(
      { name: '👤 משתמש', value: `<@${appointment.userId}> (${appointment.username})`, inline: true },
      { name: '💼 עובד', value: workerName, inline: true },
      { name: '📅 תאריך', value: dateStr, inline: false },
      { name: '🕐 שעה', value: `${appointment.startTime} - ${appointment.endTime}`, inline: true },
      { name: '📝 הערה', value: appointment.note || 'אין הערה', inline: false },
      { name: '📊 סטטוס', value: statusLabels[status], inline: true }
    )
    .setFooter({ text: `מזהה בקשה: ${appointment._id}` })
    .setTimestamp();
}

// ─── Send approval request to channel ────────────────────────────────────────
async function sendApprovalRequest(appointment, slot) {
  try {
    const channel = await client.channels.fetch(APPROVAL_CHANNEL_ID);
    if (!channel) throw new Error('Channel not found');

    const embed = buildEmbed(appointment, 'pending');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${appointment._id}`)
        .setLabel('✅ אשר תור')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${appointment._id}`)
        .setLabel('❌ דחה תור')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    // Save message ID
    appointment.discordMessageId = msg.id;
    await appointment.save();

    console.log(`📨 Approval request sent for appointment ${appointment._id}`);
  } catch (err) {
    console.error('sendApprovalRequest error:', err);
    throw err;
  }
}

// ─── DM user with result ──────────────────────────────────────────────────────
async function dmUser(appointment, status) {
  try {
    const user = await client.users.fetch(appointment.userId);
    if (!user) return;

    const dateStr = new Date(appointment.date).toLocaleDateString('he-IL', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const workerName = appointment.workerId?.name || 'העובד';

    if (status === 'approved') {
      const embed = new EmbedBuilder()
        .setTitle('✅ התור שלך אושר!')
        .setColor(0x2ECC71)
        .setDescription(`שלום <@${appointment.userId}>! 🎉\nהתור שלך ב-**Ido & Jonathan Shop** אושר!`)
        .addFields(
          { name: '💼 עובד', value: workerName, inline: true },
          { name: '📅 תאריך', value: dateStr, inline: true },
          { name: '🕐 שעה', value: `${appointment.startTime} - ${appointment.endTime}`, inline: true }
        )
        .setFooter({ text: 'אנא הגע בזמן! ✂️' })
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('❌ התור לא אושר')
        .setColor(0xE74C3C)
        .setDescription(`שלום <@${appointment.userId}>.\nלצערנו, **לא אושר לך התור** בתאריך ${dateStr} בשעה ${appointment.startTime}.\nניתן לנסות לקבוע תור בזמן אחר.`)
        .setTimestamp();

      await user.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('DM error:', err.message);
  }
}

// ─── Notify user (called from API) ───────────────────────────────────────────
async function notifyUser(appointment) {
  await dmUser(appointment, appointment.status);
}

// Login bot
client.login(process.env.DISCORD_BOT_TOKEN);

module.exports = { sendApprovalRequest, notifyUser, client };
