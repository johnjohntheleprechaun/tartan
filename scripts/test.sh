BAR="\n-------------------------\n"

if [[ "$1" != "" ]]; then
    pkg=$(jq -r '.name' "packages/$1/package.json")
    printf "${BAR}\033[0;32mtesting $pkg...\033[0m${BAR}"
    (cd "packages/$1" && npx tsx ../../node_modules/jasmine/bin/jasmine.js)
else
    for dir in packages/*; do
        pkg=$(jq -r '.name' "$dir/package.json")
        printf "${BAR}\033[0;32mtesting $pkg...\033[0m${BAR}"
        (cd "$dir" && npx tsx ../../node_modules/jasmine/bin/jasmine.js)
    done
fi
