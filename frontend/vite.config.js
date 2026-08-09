import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  console.log('=== VITE BUILD-TIME ENV DIAGNOSTIC ===');
  console.log('process.env.SUPABASE_URL:', process.env.SUPABASE_URL ? 'FOUND (starts with ' + process.env.SUPABASE_URL.substring(0, 10) + ')' : 'NOT FOUND');
  console.log('process.env.SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'FOUND' : 'NOT FOUND');
  console.log('env.SUPABASE_URL:', env.SUPABASE_URL ? 'FOUND' : 'NOT FOUND');
  console.log('env.SUPABASE_ANON_KEY:', env.SUPABASE_ANON_KEY ? 'FOUND' : 'NOT FOUND');
  console.log('=====================================');

  return {
    plugins: [react()],
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || env.SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '')
    },
    server: {
      proxy: {
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        }
      }
    }
  };
})
