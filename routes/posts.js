import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category } = req.query; // category = id da categoria enviada na URL

    // Monta o SELECT base
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles(username, avatar_url),
        categories(name, slug)
      `)
      .order('created_at', { ascending: false });

    //Buscando por category_id?
    if (category) {
      query = query.eq('category_id', category);
    }

    // Executa query com filtro aplicado
    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Erro ao carregar posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(username, avatar_url),
        categories(name, slug)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    console.log('📦 Corpo recebido:', req.body);
    const { title, content, category_id, author_id } = req.body;
    const safeContent = content ?? '';

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', author_id)
      .maybeSingle();

    if (!existingProfile) {
      return res.status(400).json({ error: 'User profile not found' });
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        title,
        content: safeContent,
        category_id,
        author_id
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const { data, error } = await supabase
      .from('posts')
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
