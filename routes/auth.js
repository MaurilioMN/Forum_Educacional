import express from 'express';
import { createSupabaseClient } from '../config/supabase.js';
import { supabaseAdmin, hasServiceRoleKey } from '../config/supabaseAdmin.js';

const isMissingBioColumnError = (error) =>
  error?.code === '42703' || /column\s+"?bio"?/i.test(error?.message || '');

const upsertProfileWithFallback = async (client, profile) => {
  const { error } = await client
    .from('profiles')
    .upsert(profile, { onConflict: 'id' });

  if (error && isMissingBioColumnError(error) && 'bio' in profile) {
    console.warn(
      'Profiles table is missing the bio column. Retrying profile upsert without the bio field.'
    );

    const { bio, ...profileWithoutBio } = profile;
    const { error: retryError } = await client
      .from('profiles')
      .upsert(profileWithoutBio, { onConflict: 'id' });

    if (!retryError) {
      console.warn(
        'Profile upsert succeeded after removing the bio field. Consider updating your database migration to include the bio column.'
      );
    }

    return { error: retryError };
  }

  return { error };
};

const insertProfileWithFallback = async (client, profile) => {
  const { error } = await client.from('profiles').insert(profile);

  if (error && isMissingBioColumnError(error) && 'bio' in profile) {
    console.warn(
      'Profiles table is missing the bio column. Retrying profile insert without the bio field.'
    );

    const { bio, ...profileWithoutBio } = profile;
    const { error: retryError } = await client
      .from('profiles')
      .insert(profileWithoutBio);

    if (!retryError) {
      console.warn(
        'Profile insert succeeded after removing the bio field. Consider updating your database migration to include the bio column.'
      );
    }

    return retryError;
  }

  return error;
};

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const supabaseClient = createSupabaseClient();
    const { email, password, username } = req.body;

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      const profileUsername = username || email.split('@')[0];
      const canHydrateSession = Boolean(
        data.session?.access_token && data.session?.refresh_token
      );

      let profileError = null;

      if (canHydrateSession) {
        const { error: setSessionError } = await supabaseClient.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        if (setSessionError) {
          console.error('Failed to hydrate signup session:', setSessionError);
        }
      }

      const profilePayload = {
        id: data.user.id,
        username: profileUsername,
        avatar_url: '',
        bio: ''
      };

      if (hasServiceRoleKey && supabaseAdmin) {
        ({ error: profileError } = await upsertProfileWithFallback(
          supabaseAdmin,
          profilePayload
        ));
      } else if (canHydrateSession) {
        ({ error: profileError } = await upsertProfileWithFallback(
          supabaseClient,
          profilePayload
        ));
      }

      if (profileError) {
        console.error('Profile creation error:', profileError);

        if (hasServiceRoleKey && supabaseAdmin) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(data.user.id);
          } catch (cleanupError) {
            console.error('Cleanup error removing orphaned auth user:', cleanupError);
          }
        }

        return res.status(500).json({ error: 'Failed to create user profile' });
      }
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
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