import { createClient } from '@supabase/supabase-js'

// Public values (anon key is safe in the client; RLS protects data).
// Override via VITE_* env; defaults keep the deployed build working without Vercel env config.
const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://iqvatbxcvriwxclfxeln.supabase.co'
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxdmF0YnhjdnJpd3hjbGZ4ZWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzkyMjcsImV4cCI6MjEwMTM1NTIyN30.gsJBTCFYxTKRejv4cdjKzwCQWWp49Tn1jfPlmJcDgQg'

export const supabase = createClient(url, anonKey)

export type Profile = {
  id: string
  name: string
  language: string
  job_role: string | null
  avatar_url: string | null
}
