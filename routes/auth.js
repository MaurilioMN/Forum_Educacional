import express from 'express';
import { createSupabaseClient } from '../config/supabase.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      // cria o perfil manualmente (caso o trigger não rode)
      const profileUsername = username || email.split('@')[0];
      await supabase.from('profiles').insert({
        id: data.user.id,
        username: profileUsername,
        avatar_url: '',
        bio: ''
      });
    }

    res.status(200).json({ message: 'Usuário criado com sucesso', data });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Erro interno ao salvar novo usuário' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const supabaseClient = createSupabaseClient();
    const { email, password } = req.body;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      const canHydrateSession = Boolean(
        data.session?.access_token && data.session?.refresh_token
      );

      if (canHydrateSession) {
        const { error: setSessionError } = await supabaseClient.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        if (setSessionError) {
          console.error('Failed to hydrate login session:', setSessionError);
          return res.status(500).json({ error: 'Failed to establish user session' });
        }
      }

      const { data: profile, error: profileLookupError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileLookupError) {
        console.error('Profile lookup error during login:', profileLookupError);
        return res.status(500).json({ error: 'Failed to load user profile' });
      }

      if (!profile) {
        const username = email.split('@')[0];
        const profilePayload = {
          id: data.user.id,
          username: username,
          avatar_url: '',
          bio: ''
        };

        const profileInsertError = await insertProfileWithFallback(
          supabaseClient,
          profilePayload
        );

        if (profileInsertError) {
          console.error('Profile creation error during login:', profileInsertError);
          return res.status(500).json({ error: 'Failed to prepare user profile' });
        }
      }
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const supabaseClient = createSupabaseClient();
    const { error } = await supabaseClient.auth.signOut();

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
    const supabaseClient = createSupabaseClient();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.json({ session: null });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabaseClient.auth.getUser(token);

    if (error) {
      return res.json({ session: null });
    }

    res.json({ session: { user: data.user } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;