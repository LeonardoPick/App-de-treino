/**
 * build-env.js
 * Executado automaticamente no deploy da Vercel (`npm run build`).
 * Injeta as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no bundle estático.
 */

const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const envScript = `<script>window.__ENV__ = { VITE_SUPABASE_URL: ${JSON.stringify(supabaseUrl)}, VITE_SUPABASE_ANON_KEY: ${JSON.stringify(supabaseAnonKey)} };</script>`;

if (!html.includes('window.__ENV__')) {
  html = html.replace('</head>', `  ${envScript}\n</head>`);
  fs.writeFileSync(indexPath, html, 'utf8');
}

console.log('✓ Build concluído com variáveis de ambiente Supabase configuradas.');
