/*
  # Fix RLS policies for users table

  1. Security Changes
    - Drop existing problematic policies that cause infinite recursion
    - Create simple, safe policies for users table
    - Ensure policies don't reference the same table they're protecting

  2. New Policies
    - Users can insert their own profile (simple auth.uid() check)
    - Users can read their own profile
    - Users can update their own profile
    - Public read access for basic user info (needed for event organizers)
*/

-- Drop all existing policies for users table to start fresh
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Temporary admin check policy" ON users;
DROP POLICY IF EXISTS "Temporary admin creation policy" ON users;
DROP POLICY IF EXISTS "Temporary connectivity check policy" ON users;

-- Create simple, safe policies that don't cause recursion
CREATE POLICY "Enable insert for authenticated users only"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable read access for own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Enable update for own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow public read access to basic user info (needed for displaying event organizers)
CREATE POLICY "Enable read access for public user info"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);