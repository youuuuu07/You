const fs = require('fs');
const path = require('path');

// Chemin du fichier à corriger
const filePath = path.join(__dirname, 'src', 'main', 'mainViewWindow.js');

// Lire le contenu du fichier
let content = fs.readFileSync(filePath, 'utf8');

// Vérifier la structure du fichier
function checkBrackets(code) {
  const stack = [];
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultilineComment = false;
  
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1] || '';
    
    // Gérer les commentaires
    if (!inString) {
      if (!inComment && !inMultilineComment && char === '/' && nextChar === '/') {
        inComment = true;
        continue;
      }
      
      if (!inComment && !inMultilineComment && char === '/' && nextChar === '*') {
        inMultilineComment = true;
        i++; // Sauter le prochain caractère
        continue;
      }
      
      if (inComment && char === '\n') {
        inComment = false;
        continue;
      }
      
      if (inMultilineComment && char === '*' && nextChar === '/') {
        inMultilineComment = false;
        i++; // Sauter le prochain caractère
        continue;
      }
      
      if (inComment || inMultilineComment) {
        continue;
      }
    }
    
    // Gérer les chaînes de caractères
    if ((char === '"' || char === "'" || char === '`') && (i === 0 || code[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }
    
    if (inString) {
      continue;
    }
    
    // Vérifier les accolades, parenthèses et crochets
    if (char === '{' || char === '(' || char === '[') {
      stack.push({char, index: i});
    } else if (char === '}' || char === ')' || char === ']') {
      const expected = char === '}' ? '{' : (char === ')' ? '(' : '[');
      if (stack.length === 0 || stack[stack.length - 1].char !== expected) {
        return {
          error: `Unexpected closing bracket '${char}' at position ${i}`,
          position: i
        };
      }
      stack.pop();
    }
  }
  
  if (stack.length > 0) {
    const last = stack[stack.length - 1];
    return {
      error: `Unclosed bracket '${last.char}' at position ${last.index}`,
      position: last.index
    };
  }
  
  return { error: null };
}

// Vérifier la structure
const checkResult = checkBrackets(content);

if (checkResult.error) {
  console.error(checkResult.error);
  
  // Trouver la ligne et la colonne de l'erreur
  const lines = content.substring(0, checkResult.position).split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  
  console.error(`Error at line ${line}, column ${column}`);
  
  // Afficher le contexte de l'erreur
  const errorLine = content.split('\n')[line - 1];
  console.error(`Line ${line}: ${errorLine}`);
  console.error(' '.repeat(column + String(line).length + 2) + '^');
} else {
  console.log('No syntax errors found in the file structure.');
}

// Vérifier si le fichier se termine correctement
const trimmedContent = content.trim();
if (!trimmedContent.endsWith('};')) {
  console.error('File does not end with the proper module.exports closing bracket.');
  
  // Corriger la fin du fichier
  const moduleExportsIndex = content.lastIndexOf('module.exports');
  if (moduleExportsIndex !== -1) {
    // Trouver la fin de la déclaration module.exports
    let endIndex = content.indexOf('};', moduleExportsIndex);
    if (endIndex !== -1) {
      endIndex += 2;
      
      // Tronquer le fichier à cet endroit
      content = content.substring(0, endIndex);
      
      // Ajouter une nouvelle ligne à la fin
      content += '\n';
      
      // Écrire le contenu corrigé
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('File has been fixed.');
    }
  }
}
