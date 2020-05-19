pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

interface IKODAV2ArtistBurner {
  function editionActive(uint256 _editionNumber) external view returns (bool);

  function artistCommission(uint256 _editionNumber) external view returns (address _artistAccount, uint256 _artistCommission);

  function updateActive(uint256 _editionNumber, bool _active) external;

  function totalSupplyEdition(uint256 _editionNumber) external view returns (uint256);

  function totalRemaining(uint256 _editionNumber) external view returns (uint256);

  function updateTotalAvailable(uint256 _editionNumber, uint256 _totalAvailable) external;
}

/**
* @title Artists burning contract for KnownOrigin (KODA)
*
* Allows for edition artists to burn unsold works or reduce the supply of sold tokens from editions
*
* https://www.knownorigin.io/
*
* BE ORIGINAL. BUY ORIGINAL.
*/
contract ArtistEditionBurner is Ownable, Pausable {
  using SafeMath for uint256;

  // Interface into the KODA world
  IKODAV2ArtistBurner public kodaAddress;

  event EditionDeactivated(
    uint256 indexed _editionNumber
  );

  event EditionSupplyReduced(
    uint256 indexed _editionNumber
  );

  constructor(IKODAV2ArtistBurner _kodaAddress) public {
    kodaAddress = _kodaAddress;
  }

  /**
   * @dev Sets the provided edition to either a deactivated state or reduces the available supply to zero
   * @dev Only callable from edition artists defined in KODA NFT contract
   * @dev Only callable when contract is not paused
   * @dev Reverts if edition is invalid
   * @dev Reverts if edition is not active in KDOA NFT contract
   */
  function deactivateOrReduceEditionSupply(uint256 _editionNumber) external whenNotPaused {
    (address artistAccount, uint256 _) = kodaAddress.artistCommission(_editionNumber);
    require(msg.sender == artistAccount || msg.sender == owner, "Only from the edition artist account");

    // only allow them to be disabled if we have not already done it already
    bool isActive = kodaAddress.editionActive(_editionNumber);
    require(isActive, "Only when edition is active");

    // only allow changes if not sold out
    uint256 totalRemaining = kodaAddress.totalRemaining(_editionNumber);
    require(totalRemaining > 0, "Only when edition not sold out");

    // total issued so far
    uint256 totalSupply = kodaAddress.totalSupplyEdition(_editionNumber);

    // if no tokens issued, simply disable the edition, burn it!
    if (totalSupply == 0) {
      kodaAddress.updateActive(_editionNumber, false);
      kodaAddress.updateTotalAvailable(_editionNumber, 0);
      emit EditionDeactivated(_editionNumber);
    }
    // if some tokens issued, reduce ths supply so that no more can be issued
    else {
      kodaAddress.updateTotalAvailable(_editionNumber, totalSupply);
      emit EditionSupplyReduced(_editionNumber);
    }
  }

  /**
   * @dev Sets the KODA address
   * @dev Only callable from owner
   */
  function setKodavV2(IKODAV2ArtistBurner _kodaAddress) onlyOwner public {
    kodaAddress = _kodaAddress;
  }

}
