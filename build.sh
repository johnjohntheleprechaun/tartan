echo "ensuring packages are installed..."
npm install

echo "building typescript..."
npx tsc
chmod +x dist/index.js

echo "processing component library..."
npx ts-node src/build.ts
