import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

const CONNECTIVITY_PATTERNS = [
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'network request failed',
  'getaddrinfo enotfound',
  'econnrefused',
  'etimedout',
  'eai_again',
  'connection refused'
];

function isConnectivityMessage(message = '') {
  const normalized = message.toLowerCase();
  return CONNECTIVITY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function mapSupabaseErrorResponse(error, fallbackStatus = 400, fallbackMessage = 'Request failed') {
  const message = error?.message || fallbackMessage;
  const causeMessage = error?.cause?.message || '';
  const codeMessage = typeof error?.code === 'string' ? error.code : '';

  if (isConnectivityMessage(message) || isConnectivityMessage(causeMessage) || isConnectivityMessage(codeMessage)) {
    return {
      status: 503,
      message: 'Unable to connect to Supabase. Please verify your database credentials and network access.'
    };
  }

  return {
    status: fallbackStatus,
    message
  };
}

function respondWithUnexpectedError(res, error, context) {
  console.error(`Auth ${context} error:`, error);
  const mapped = mapSupabaseErrorResponse(error, 500, 'Internal server error');

  if (mapped.status === 500) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(mapped.status).json({ error: mapped.message });
}

router.post('/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      const mapped = mapSupabaseErrorResponse(error, 400, 'Signup failed');
      return res.status(mapped.status).json({ error: mapped.message });
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
    respondWithUnexpectedError(res, error, 'signup');
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
      const mapped = mapSupabaseErrorResponse(error, 400, 'Login failed');
      return res.status(mapped.status).json({ error: mapped.message });
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
    respondWithUnexpectedError(res, error, 'login');
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      const mapped = mapSupabaseErrorResponse(error, 400, 'Logout failed');
      return res.status(mapped.status).json({ error: mapped.message });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    respondWithUnexpectedError(res, error, 'logout');
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
      const mapped = mapSupabaseErrorResponse(error, 200, '');

      if (mapped.status === 503) {
        return res.status(503).json({ error: mapped.message, session: null });
      }

      return res.json({ session: null });
    }

    res.json({ session: { user: data.user } });
  } catch (error) {
    respondWithUnexpectedError(res, error, 'session');
  }
});

export default router;
