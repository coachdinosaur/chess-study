const { execSync } = require('child_process');
try {
  execSync('git restore styles.css', { stdio: 'inherit' });
  console.log('Successfully restored styles.css');
} catch (e) {
  console.error(e);
}
