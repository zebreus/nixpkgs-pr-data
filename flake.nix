{
  description = "A dashboard for the number of nix pullrequests";

  outputs = { self, nixpkgs }: {
    packages.x86_64-linux.default = with nixpkgs.legacyPackages.x86_64-linux.pkgs; stdenv.mkDerivation {
      pname = "nix-pr-board";
      version = "0.1.0";
      buildInputs = [ deno nil ];
      src = ./.;
    };
  };
}
