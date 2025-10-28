import express from 'express';
const isMissingBioColumnError = (error) =>
  error?.code === '42703' || /column\s+"?bio"?/i.test(error?.message || '');

const updateProfileWithFallback = async (id, updateData) => {
  const baseQuery = () =>
    supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

  const { data, error } = await baseQuery();

  if (error && isMissingBioColumnError(error) && 'bio' in updateData) {
    console.warn(
      'Profiles table is missing the bio column. Retrying profile update without the bio field.'
    );

    const { bio, ...updateWithoutBio } = updateData;

    if (Object.keys(updateWithoutBio).length === 0) {
      return {
        data: null,
        error: {
          message:
            'The profiles table is missing the bio column. Update your database migration to re-enable bio editing.'
        }
      };
    }

    const {
      data: retryData,
      error: retryError
    } = await supabase
      .from('profiles')
      .update(updateWithoutBio)
      .eq('id', id)
      .select()
      .single();

    if (!retryError) {
      console.warn(
        'Profile update succeeded after removing the bio field. Consider updating your database migration to include the bio column.'
      );
    }

    return { data: retryData, error: retryError };
  }

  return { data, error };
};


const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/posts', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(username, avatar_url),
        categories(name, slug)
      `)
      .eq('author_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const postsWithCounts = await Promise.all(
      (data || []).map(async (post) => {
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        return { ...post, comment_count: count || 0 };
      })
    );

    res.json(postsWithCounts);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, bio, avatar_url } = req.body;

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const { data, error } = await updateProfileWithFallback(id, updateData);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
