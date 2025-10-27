import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
};

export const createSupabaseClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, clientOptions);

export const supabase = createSupabaseClient();