echo "ensuring packages are installed..."
npm install

echo "deleting previous build..."
rm -r dist

echo "building typescript..."
npx tsc
chmod +x dist/index.js
