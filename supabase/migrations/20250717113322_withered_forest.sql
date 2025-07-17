/*
  # Clean and recreate users table policies

  1. Security Changes
    - Drop all existing policies to avoid conflicts
    - Recreate simple, non-recursive policies
    - Ensure proper RLS configuration

  2. Policy Changes
    - Simple insert policy for authenticated users
    - Read own data policy
    - Update own data policy
    - Public read access for basic info
*/

-- Disable RLS temporarily to avoid issues during cleanup
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies (using CASCADE to handle dependencies)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON users CASCADE';
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create new simple policies
CREATE POLICY "users_can_insert_own" 
  ON users 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_can_read_own" 
  ON users 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "users_can_update_own" 
  ON users 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_public_read" 
  ON users 
  FOR SELECT 
  TO authenticated 
  USING (true);