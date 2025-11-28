# ESLint Setup Instructions

## After installing Node.js, run these commands in your terminal:

### 1. Install ESLint locally in your project
```powershell
npm install eslint --save-dev
```

### 2. Install additional ESLint plugins (optional but recommended)
```powershell
npm install @eslint/js --save-dev
```

### 3. Run ESLint on your JavaScript files
```powershell
# Check a specific file
npx eslint Text_Analytics_Dashboard.js

# Check all JavaScript files
npx eslint *.js

# Auto-fix issues that can be automatically corrected
npx eslint Text_Analytics_Dashboard.js --fix
```

### 4. VS Code Integration
- The ESLint extension will automatically use the .eslintrc.json file I created
- You'll see real-time linting as you type
- Use Ctrl+Shift+P and search "ESLint: Fix all auto-fixable problems" to fix issues

### 5. Customize Rules
Edit the .eslintrc.json file to:
- Turn rules on/off ("error", "warn", "off")
- Add new rules
- Configure rule-specific options

## Common ESLint Commands:
- `npx eslint --init` - Interactive setup (alternative to manual config)
- `npx eslint . --fix` - Fix all files in current directory
- `npx eslint --help` - Show all available options