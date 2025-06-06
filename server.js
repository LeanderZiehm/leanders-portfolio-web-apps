require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  SESSION_SECRET,
  PORT = 5001,
  ADMIN_EMAIL
} = process.env;

app.use(express.static('public'));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK_URL)}&scope=read:user user:email`;
  res.redirect(authUrl);
});

app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const { access_token } = await tokenRes.json();

    if (!access_token) return res.status(400).send('Failed to get access token');

    // Get profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    });
    const user = await userRes.json();

    // Get primary email
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    });
    const emails = await emailRes.json();
    const primaryEmail = emails.find(e => e.primary && e.verified)?.email || null;

    user.email = primaryEmail;
    user.isAdmin = primaryEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    req.session.user = user;
    res.redirect('/profile');
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).send('OAuth error');
  }
});

app.get('/profile', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/api/user', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

