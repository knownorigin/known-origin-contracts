pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../interfaces/IKODAV2Controls.sol";

/**
* @title Artists self minting for KnownOrigin (KODA)
*
* Allows for the edition artists to mint there own assets and control the price of an edition
*
* https://www.knownorigin.io/
*
* BE ORIGINAL. BUY ORIGINAL.
*/
contract ArtistEditionControls is Ownable, Pausable {
  using SafeMath for uint256;

  // Interface into the KODA world
  IKODAV2Controls public kodaAddress;

  event PriceChanged(
    uint256 indexed _editionNumber,
    address indexed _artist,
    uint256 _priceInWei
  );

  constructor(IKODAV2Controls _kodaAddress) public {
    kodaAddress = _kodaAddress;
  }

  /**
   * @dev Ability to gift new NFTs to an address, from a KODA edition
   * @dev Only callable from edition artists defined in KODA NFT contract
   * @dev Only callable when contract is not paused
   * @dev Reverts if edition is invalid
   * @dev Reverts if edition is not active in KDOA NFT contract
   */
  function gift(address _receivingAddress, uint256 _editionNumber)
  external
  whenNotPaused
  returns (uint256)
  {
    require(_receivingAddress != address(0), "Unable to send to zero address");

    address artistAccount;
    uint256 artistCommission;
    (artistAccount, artistCommission) = kodaAddress.artistCommission(_editionNumber);
    require(msg.sender == artistAccount || msg.sender == owner, "Only from the edition artist account");

    bool isActive = kodaAddress.editionActive(_editionNumber);
    require(isActive, "Only when edition is active");

    return kodaAddress.mint(_receivingAddress, _editionNumber);
  }

  /**
   * @dev Sets the price of the provided edition in the WEI
   * @dev Only callable from edition artists defined in KODA NFT contract
   * @dev Only callable when contract is not paused
   * @dev Reverts if edition is invalid
   * @dev Reverts if edition is not active in KDOA NFT contract
   */
  function updateEditionPrice(uint256 _editionNumber, uint256 _priceInWei)
  external
  whenNotPaused
  returns (bool)
  {
    address artistAccount;
    uint256 artistCommission;
    (artistAccount, artistCommission) = kodaAddress.artistCommission(_editionNumber);
    require(msg.sender == artistAccount || msg.sender == owner, "Only from the edition artist account");

    bool isActive = kodaAddress.editionActive(_editionNumber);
    require(isActive, "Only when edition is active");

    kodaAddress.updatePriceInWei(_editionNumber, _priceInWei);

    emit PriceChanged(_editionNumber, msg.sender, _priceInWei);

    return true;
  }

  /**
   * @dev Sets the KODA address
   * @dev Only callable from owner
   */
  function setKodavV2(IKODAV2Controls _kodaAddress) onlyOwner public {
    kodaAddress = _kodaAddress;
  }
}
