pragma solidity 0.4.24;

interface IKODAAuction {
  function setArtistsControlAddressAndEnabledEdition(uint256 _editionNumber, address _address) external;
}
