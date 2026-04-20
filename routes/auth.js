const express = require('express');
const passport = require('passport');
const router = express.Router();

// Start Discord OAuth
router.get('/discord', passport.authenticate('discord'));

// Discord callback
router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => {
    // Block users without any required role
    if (!req.user.isMember && !req.user.isAdmin) {
      req.logout(() => {});
      return res.redirect('/?error=no_role');
    }
    res.redirect('/');
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      discriminator: req.user.discriminator,
      avatar: req.user.avatar,
      isMember: req.user.isMember,
      isAdmin: req.user.isAdmin
    }
  });
});

module.exports = router;
