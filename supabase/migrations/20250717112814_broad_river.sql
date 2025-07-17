/*
  # Fix RLS policies for users table

  1. Security Changes
    - Drop all existing policies that cause infinite recursion
    - Create simple, safe policies that don't reference the users table in conditions
    - Maintain security while avoiding circular references

  2. New Policies
    - Users can insert their own profile
    - Users can read their own profile
    - Users can update their own profile
    - Public read access for basic user info (needed for event organizers display)
*/

-- Drop all existing policies for users table
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
DROP POLICY IF EXISTS "Enable read access for own profile" ON users;
DROP POLICY IF EXISTS "Enable read access for public user info" ON users;
DROP POLICY IF EXISTS "Enable update for own profile" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- Create new simple policies without recursion
CREATE POLICY "users_insert_own" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_select_own" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_select_public" ON users
  FOR SELECT
  TO authenticated
  USING (true);