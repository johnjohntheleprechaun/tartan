BAR="\n-------------------------\n"

printf "${BAR}\033[0;32mbuilding @tartan/core...\033[0m${BAR}"
(cd packages/core && npm run build)

printf "${BAR}\033[0;32mbuilding @tartan/cli...\033[0m${BAR}"
(cd packages/cli && npm run build)
