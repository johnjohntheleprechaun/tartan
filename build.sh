echo "ensuring packages are installed..."
npm install

echo "building typescript..."
npx tsc
chmod +x dist/bin/index.js
