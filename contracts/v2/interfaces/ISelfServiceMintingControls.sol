pragma solidity 0.4.24;

interface ISelfServiceMintingControls {
  function canMint(address minter) external view returns (bool);

  function recordSuccessfulMint(address minter) external returns (bool);
}
