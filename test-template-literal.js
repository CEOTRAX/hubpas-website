// Test the exact template literal from admin.html
const key = 'testKey';
const error = new Error('test error');

try {
  console.error(`Error creating field for key "${key}":`, error);
  console.log('Template literal syntax is valid');
} catch (e) {
  console.error('Template literal syntax error:', e);
}