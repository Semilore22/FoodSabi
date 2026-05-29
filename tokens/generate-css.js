const fs = require('fs');
const path = require('path');

const colorsPath = path.join(__dirname, 'tokens', 'color-token.json');
const typographyPath = path.join(__dirname, 'design-tokens.tokens.json');
const outputPath = path.join(__dirname, 'tokens', 'tokens.css');

const colorsJson = JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
const typographyJson = JSON.parse(fs.readFileSync(typographyPath, 'utf8'));

let css = '/* Automatically generated from design tokens */\n\n:root {\n';

// Helper to convert camelCase to kebab-case
function toKebabCase(str) {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase().replace(/^-/, '');
}

// 1. Process Color Roles
const colorRoles = colorsJson.color.role;

function resolveColor(ref) {
  if (typeof ref === 'string' && ref.startsWith('{') && ref.endsWith('}')) {
    const keys = ref.slice(1, -1).split('.');
    let current = colorsJson;
    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        return ref; // Unresolvable
      }
    }
    return current;
  }
  return ref;
}

// Add light theme colors as default
css += '  /* Light Theme Color Roles */\n';
for (const [role, value] of Object.entries(colorRoles.light)) {
  const cssVarName = `--color-${toKebabCase(role)}`;
  css += `  ${cssVarName}: ${resolveColor(value)};\n`;
}

// 2. Process Typography
css += '\n  /* Typography */\n';
const typography = typographyJson.typography || typographyJson.font;

function processTypographyValue(key, val) {
  if (typeof val === 'object' && val !== null && val.value !== undefined) {
    let value = val.value;
    if (val.type === 'dimension' || typeof value === 'number') {
      if (key === 'fontWeight') {
        return value;
      }
      return value === 0 ? '0' : `${value}px`;
    }
    return value;
  }
  return val;
}

for (const [category, styles] of Object.entries(typography)) {
  const categoryKebab = category.replace(/\s+/g, '-');
  
  for (const [property, valueObj] of Object.entries(styles)) {
    const propKebab = toKebabCase(property);
    const cssVarName = `--typography-${categoryKebab}-${propKebab}`;
    const cssValue = processTypographyValue(property, valueObj);
    css += `  ${cssVarName}: ${cssValue};\n`;
  }
}

css += '}\n\n';

// 3. Process Dark Theme Colors
css += '@media (prefers-color-scheme: dark) {\n';
css += '  :root {\n';
css += '    /* Dark Theme Color Roles */\n';
for (const [role, value] of Object.entries(colorRoles.dark)) {
  const cssVarName = `--color-${toKebabCase(role)}`;
  css += `    ${cssVarName}: ${resolveColor(value)};\n`;
}
css += '  }\n';
css += '}\n';

fs.writeFileSync(outputPath, css, 'utf8');
console.log(`Successfully generated CSS variables at ${outputPath}`);
