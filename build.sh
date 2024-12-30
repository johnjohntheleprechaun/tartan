echo "ensuring packages are installed..."
npm install

echo "building typescript..."
npx tsc

echo "processing component library..."
npx ts-node src/build.ts
