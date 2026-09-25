import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://atywnmldzhwniguvinpa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eXdubWxkemh3bmlndXZpbnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjQyMzEsImV4cCI6MjEwMTg0MDIzMX0.rssSR4bo7alDqzlkU2sjU9eV6Cz5yIaS2M5F2_QEbrA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);