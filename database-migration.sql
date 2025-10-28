/*
  # Forum Database Schema Migration

  This SQL script creates the complete database schema for the forum application.

  ## Instructions:
  1. Go to your Supabase project dashboard
  2. Navigate to SQL Editor
  3. Copy and paste this entire file
  4. Click "Run" to execute the migration

  ## What this migration creates:

  1. Tables:
    - categories: Forum categories with name, description, and slug
    - posts: Forum posts with title, content, author, and category
    - comments: Comments on posts with content and author
    - profiles: User profiles with username and avatar

  2. Security (Row Level Security):
    - All tables have RLS enabled
    - Public read access for categories, posts, comments, and profiles
    - Authenticated users can create posts and comments
    - Users can only update/delete their own content

  3. Default Data:
    - Four default categories (General, Technology, Help, Announcements)

  4. Indexes:
    - Optimized for category filtering and chronological sorting
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS posts_category_id_idx ON posts(category_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments(post_id);
CREATE INDEX IF NOT EXISTS comments_created_at_idx ON comments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Categories policies (public read access)
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

-- Posts policies
CREATE POLICY "Anyone can view posts"
  ON posts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Comments policies
CREATE POLICY "Anyone can view comments"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Profiles policies
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert default categories
INSERT INTO categories (name, description, slug) VALUES
  ('General', 'General discussion topics', 'general'),
  ('Technology', 'Discuss technology and programming', 'technology'),
  ('Help', 'Get help and support', 'help'),
  ('Announcements', 'Important announcements', 'announcements')
ON CONFLICT (slug) DO NOTHING;

alter table posts
drop constraint if exists fk_posts_profiles,
drop constraint if exists posts_author_id_fkey;

alter table posts
add constraint fk_posts_profiles
foreign key (author_id)
references profiles (id)
on delete cascade;

-- Função para criar perfil automaticamente
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql;

-- Trigger que chama a função ao criar um novo usuário
drop trigger if exists create_profile_after_user on auth.users;

create trigger create_profile_after_user
after insert on auth.users
for each row
execute function public.handle_new_user();

select * from auth.users;

select trigger_name, event_manipulation, event_object_table
from information_schema.triggers
where event_object_table = 'users';
 
select column_name, data_type from information_schema.columns where table_name = 'profiles';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text default '',
  bio text default '',
  created_at timestamp with time zone default now()
);