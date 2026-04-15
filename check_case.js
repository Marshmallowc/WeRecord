const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const output = execSync('grep -r "import " src/').toString();
  const lines = output.split('\n');
  lines.forEach(line => {
    const match = line.match(/from\s+['"]([^'"]+)['"]/);
    if (!match) return;
    let importPath = match[1];
    if (importPath.startsWith('.')) {
      const sourceFile = line.split(':')[0];
      const dir = path.dirname(sourceFile);
      let targetPath = path.resolve(dir, importPath);
      if (!fs.existsSync(targetPath)) {
        if (fs.existsSync(targetPath + '.ts')) targetPath += '.ts';
        else if (fs.existsSync(targetPath + '.tsx')) targetPath += '.tsx';
        else if (fs.existsSync(targetPath + '.js')) targetPath += '.js';
        else if (fs.existsSync(targetPath + '/index.ts')) targetPath += '/index.ts';
        else if (fs.existsSync(targetPath + '/index.tsx')) targetPath += '/index.tsx';
      }
      
      if (fs.existsSync(targetPath)) {
        const strictPathMatch = checkFileCaseSync(targetPath);
        if (!strictPathMatch) {
          console.log(`CASE MISMATCH: ${sourceFile} imports ${importPath}`);
        }
      } else {
        console.log(`NOT FOUND: ${sourceFile} imports ${importPath}`);
      }
    } else if (importPath.startsWith('@/')) {
       // handle @/
       let targetPath = path.resolve('./src', importPath.substring(2));
       if (fs.existsSync(targetPath)) {} else {
         if (fs.existsSync(targetPath + '.ts')) targetPath += '.ts';
         else if (fs.existsSync(targetPath + '.tsx')) targetPath += '.tsx';
         else if (fs.existsSync(targetPath + '.js')) targetPath += '.js';
       }
       if (fs.existsSync(targetPath)) {
         const strictPathMatch = checkFileCaseSync(targetPath);
         if (!strictPathMatch) {
           console.log(`CASE MISMATCH: ${sourceFile} imports ${importPath}`);
         }
       } else {
           console.log(`NOT FOUND: ${sourceFile} imports ${importPath}`);
       }
    }
  });
} catch(e) {}

function checkFileCaseSync(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  if (dir === '/' || dir === '') return true;
  const files = fs.readdirSync(dir);
  if (!files.includes(base)) return false;
  return checkFileCaseSync(dir);
}
