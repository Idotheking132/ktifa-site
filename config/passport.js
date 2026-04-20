const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const axios = require('axios');

const GUILD_ID = process.env.GUILD_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  scope: ['identify', 'guilds', 'guilds.members.read']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Fetch member roles from the guild
    const memberRes = await axios.get(
      `https://discord.com/api/v10/users/@me/guilds/${GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const roles = memberRes.data.roles || [];
    const isMember = roles.includes(MEMBER_ROLE_ID);
    const isAdmin = roles.includes(ADMIN_ROLE_ID);

    const user = {
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      accessToken,
      roles,
      isMember: isMember || isAdmin, // admins also have member access
      isAdmin
    };

    return done(null, user);
  } catch (err) {
    console.error('Discord auth error:', err.response?.data || err.message);
    // User not in guild or error
    const user = {
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      accessToken,
      roles: [],
      isMember: false,
      isAdmin: false
    };
    return done(null, user);
  }
}));
