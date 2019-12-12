pragma solidity 0.4.24;

interface ISelfServiceFrequencyControls {

  /*
   * Checks is the given artist can create another edition
   * @param artist - the edition artist
   * @param totalAvailable - the edition size
   * @param priceInWei - the edition price in wei
   */
  function canCreateNewEdition(address artist) external view returns (bool);

  /*
   * Records that an edition has been created
   * @param artist - the edition artist
   * @param totalAvailable - the edition size
   * @param priceInWei - the edition price in wei
   */
  function recordSuccessfulMint(address artist, uint256 totalAvailable, uint256 priceInWei) external returns (bool);
}
