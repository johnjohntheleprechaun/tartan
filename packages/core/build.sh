echo "deleting previous build..."
rm -r dist

echo "building typescript..."
npx tsc
