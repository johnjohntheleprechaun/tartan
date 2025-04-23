BAR="\n-------------------------\n"

if [[ "$1" != "" ]]; then
    pkg=$(jq -r '.name' "packages/$1/package.json")
    printf "${BAR}\033[0;32mtesting $pkg...\033[0m${BAR}"
    (cd "packages/$1" && npx jest --passWithNoTests)
else
    for dir in packages/*; do
        pkg=$(jq -r '.name' "$dir/package.json")
        printf "${BAR}\033[0;32mtesting $pkg...\033[0m${BAR}"
        (cd "$dir" && npx jest --passWithNoTests)
    done
fi
