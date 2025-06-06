import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  SESSION_SECRET,
  PORT = 5001,
} = process.env;

app.use(express.static('public'));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

// Home page
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/public/index.html');
});

// Redirect to GitHub for login
app.get('/login', (req, res) => {
  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK_URL)}&scope=read:user user:email`;
  res.redirect(redirectUri);
});

// GitHub OAuth callback
app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    // Exchange code for access token
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

    if (!access_token) {
      return res.status(400).send('Failed to get access token');
    }

    // Fetch GitHub user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    });

    const user = await userRes.json();
    req.session.user = user;

    res.redirect('/profile');
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).send('OAuth error');
  }
});

// Serve profile page
app.get('/profile', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(process.cwd() + '/public/profile.html');
});

// API route to get user info
app.get('/api/user', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
