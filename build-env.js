const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kgubzcnctnmtticjsezw.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const rootDir = __dirname;
const indexPath = path.join(rootDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const envScript = `<script>window.__ENV__ = { VITE_SUPABASE_URL: ${JSON.stringify(supabaseUrl)}, VITE_SUPABASE_ANON_KEY: ${JSON.stringify(supabaseAnonKey)} };</script>`;

if (!html.includes('window.__ENV__ =')) {
  html = html.replace('</head>', `  ${envScript}\n</head>`);
  fs.writeFileSync(indexPath, html, 'utf8');
} else {
  html = html.replace(/<script>window\.__ENV__\s*=\s*\{.*?\};<\/script>/s, envScript);
  fs.writeFileSync(indexPath, html, 'utf8');
}

const targets = [path.join(rootDir, 'public'), path.join(rootDir, 'dist')];

targets.forEach((targetDir) => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');

  ['manifest.json', 'sw.js'].forEach((file) => {
    const src = path.join(rootDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetDir, file));
    }
  });

  ['css', 'js'].forEach((dir) => {
    const srcDir = path.join(rootDir, dir);
    const destDir = path.join(targetDir, dir);
    if (fs.existsSync(srcDir)) {
      fs.cpSync(srcDir, destDir, { recursive: true });
    }
  });
});

console.log('✓ Build concluído: arquivos gerados na raiz, em public/ e em dist/.');
process.exit(0);
