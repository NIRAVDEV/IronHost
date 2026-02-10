-- Migration: Sync Supabase auth.users to public.users
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Ensure the public.users table exists (should already exist from 001_initial_schema.sql)
-- If not, uncomment and adapt:
-- CREATE TABLE IF NOT EXISTS public.users (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     email VARCHAR(255) UNIQUE NOT NULL,
--     username VARCHAR(100),
--     password_hash VARCHAR(255),  -- nullable for OAuth users
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- 2. Create trigger function to sync auth.users -> public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, username, password_hash, created_at)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        '',  -- OAuth users don't have a password hash
        new.created_at
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, public.users.username),
        updated_at = NOW();
    RETURN new;
END;
$$;

-- 3. Create the trigger (drop first if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. (Optional) Backfill existing auth.users into public.users
-- INSERT INTO public.users (id, email, username, password_hash, created_at)
-- SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), '', created_at
-- FROM auth.users
-- ON CONFLICT (id) DO NOTHING;
