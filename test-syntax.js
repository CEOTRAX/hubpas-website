// Test syntax validation
try {
  const test = `Error creating field for key "${'test'}": ${'error'}`;
  console.log('Template literal syntax is valid');
} catch (e) {
  console.error('Syntax error:', e);
}