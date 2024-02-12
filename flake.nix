{
  description = "A json file containing data about nixpkgs pull requests";

  outputs = { self, nixpkgs }: {
    packages.x86_64-linux.default = with nixpkgs.legacyPackages.x86_64-linux.pkgs; stdenv.mkDerivation {
      pname = "nixpkgs-pr-data";
      version = "0.1.0";
      nativeBuildInputs = [ deno nil ];
      src = ./.;
      installPhase = ''
        mkdir -p $out
        cp $src/pull-requests_0-200000.json $src/pull-requests_200000-400000.json $out
      '';
    };
  };
}
