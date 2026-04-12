const fs = require('fs');
const path = require('path');

function replaceColors(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceColors(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');

      // Replace generic CSS variable logic with new tokens
      content = content.replace(/bg-\[#C49C64\]/g, 'bg-primary');
      content = content.replace(/text-\[#C49C64\]/g, 'text-primary');
      content = content.replace(/border-\[#C49C64\]/g, 'border-primary');
      content = content.replace(/accent-\[#C49C64\]/g, 'accent-primary');
      content = content.replace(/focus:border-\[#C49C64\]/g, 'focus:border-primary');
      content = content.replace(/focus:ring-\[#C49C64\]/g, 'focus:ring-primary');
      content = content.replace(/hover:border-\[#C49C64\]/g, 'hover:border-primary');
      content = content.replace(/hover:text-\[#C49C64\]/g, 'hover:text-primary');
      
      content = content.replace(/bg-\[#9B7A40\]/g, 'bg-surface-highest');
      content = content.replace(/hover:bg-\[#9B7A40\]/g, 'hover:bg-surface-highest hover:text-primary');
      
      content = content.replace(/bg-\[#1C1A17\]/g, 'bg-surface-low');
      content = content.replace(/text-\[#1C1A17\]/g, 'text-primary');
      
      // Some inline styles
      content = content.replace(/color: '#1C1A17'/g, "color: 'var(--primary)'");
      content = content.replace(/color: \"#1C1A17\"/g, "color: 'var(--primary)'");
      content = content.replace(/#C49C64/g, 'var(--primary)'); 
      
      // Any generic 'text-white' when paired with 'bg-primary' in same class string
      // A safe way is just replace text-white with text-surface-lowest when accompanied by bg-primary
      const lines = content.split('\n');
      for (let i=0; i<lines.length; i++) {
        if (lines[i].includes('bg-primary') && lines[i].includes('text-white')) {
          lines[i] = lines[i].replace(/text-white/g, 'text-surface-lowest');
        }
      }
      content = lines.join('\n');

      fs.writeFileSync(fullPath, content);
    }
  }
}

replaceColors('./app');
console.log('Replaced colors recursively in ./app');
