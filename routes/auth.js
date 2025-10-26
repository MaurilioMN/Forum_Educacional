import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      const profileUsername = username || email.split('@')[0];

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: profileUsername,
          avatar_url: '',
          bio: ''
        });

      if (profileError && !profileError.message.includes('duplicate')) {
        console.error('Profile creation error:', profileError);
      }
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        const username = email.split('@')[0];
        await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: username,
            avatar_url: '',
            bio: ''
          });
      }
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.json({ session: null });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      return res.json({ session: null });
    }

    res.json({ session: { user: data.user } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
