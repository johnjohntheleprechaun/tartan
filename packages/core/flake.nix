{
  description = "Core utils for Tartan";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = {
    self,
    nixpkgs,
  }: {
    checks.x86_64-linux = let
      nodeVersions = ["20" "22" "24"];
      dependencyHash = "";
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
    in
      builtins.listToAttrs (map (version: {
          name = "node-v${version}";
          value = pkgs.buildNpmPackage {
            name = "tartan-test-nodejs-${version}";
            src = ./.;
            npmDepsHash = dependencyHash;
            nodejs = pkgs."nodejs_${version}";

            doCheck = true;
            checkPhase = "npm test";
          };
        })
        nodeVersions);
  };
}
