pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../interfaces/IKODAV2SelfServiceEditionCuration.sol";
import "../interfaces/IKODAAuction.sol";
import "../interfaces/ISelfServiceAccessControls.sol";
import "../interfaces/ISelfServiceMintingControls.sol";

// One invocation per time-period
contract SelfServiceEditionCurationV4 is Ownable, Pausable {
  using SafeMath for uint256;

  event SelfServiceEditionCreated(
    uint256 indexed _editionNumber,
    address indexed _creator,
    uint256 _priceInWei,
    uint256 _totalAvailable,
    bool _enableAuction
  );

  // Calling address
  IKODAV2SelfServiceEditionCuration public kodaV2;
  IKODAAuction public auction;
  ISelfServiceAccessControls public accessControls;
  ISelfServiceMintingControls public mintingControls;

  // Default KO commission
  uint256 public koCommission = 15;

  // Config which enforces editions to not be over this size
  uint256 public maxEditionSize = 100;

  // Config the minimum price per edition
  uint256 public minPricePerEdition = 0.01 ether;

  /**
   * @dev Construct a new instance of the contract
   */
  constructor(
    IKODAV2SelfServiceEditionCuration _kodaV2,
    IKODAAuction _auction,
    ISelfServiceAccessControls _accessControls,
    ISelfServiceMintingControls _mintingControls
  ) public {
    kodaV2 = _kodaV2;
    auction = _auction;
    accessControls = _accessControls;
    mintingControls = _mintingControls;
  }

  /**
   * @dev Called by artists, create new edition on the KODA platform
   */
  function createEdition(
    bool _enableAuction,
    address _commissionSplitAddress,
    uint256 _commissionSplitRate,
    uint256 _totalAvailable,
    uint256 _priceInWei,
    uint256 _startDate,
    uint256 _endDate,
    uint256 _artistCommission,
    string _tokenUri
  )
  public
  whenNotPaused
  returns (uint256 _editionNumber)
  {
    require(!mintingControls.canMint(msg.sender), 'Sender currently frozen out of creation');
    require(_artistCommission.add(_commissionSplitRate).add(koCommission) <= 100, "Total commission exceeds 100");

    uint256 editionNumber = _createEdition(msg.sender, _enableAuction, _totalAvailable, _priceInWei, _artistCommission, _tokenUri);

    if (_startDate > 0) {
      kodaV2.updateStartDate(editionNumber, _startDate);
    }

    if (_endDate > 0) {
      kodaV2.updateEndDate(editionNumber, _endDate);
    }

    if (_commissionSplitRate > 0) {
      kodaV2.updateOptionalCommission(_editionNumber, _commissionSplitRate, _commissionSplitAddress);
    }

    mintingControls.recordSuccessfulMint(msg.sender);

    return editionNumber;
  }

  /**
   * @dev Caller by owner, can create editions for other artists
   * @dev Only callable from owner regardless of pause state
   */
  function createEditionFor(
    address _artist,
    bool _enableAuction,
    address _commissionSplitAddress,
    uint256 _commissionSplitRate,
    uint256 _totalAvailable,
    uint256 _priceInWei,
    uint256 _startDate,
    uint256 _endDate,
    uint256 _artistCommission,
    string _tokenUri
  )
  public
  onlyOwner
  returns (uint256 _editionNumber)
  {
    require(_artistCommission.add(_commissionSplitRate).add(koCommission) <= 100, "Total commission exceeds 100");

    uint256 editionNumber = _createEdition(_artist, _enableAuction, _totalAvailable, _priceInWei, _artistCommission, _tokenUri);

    if (_startDate > 0) {
      kodaV2.updateStartDate(editionNumber, _startDate);
    }

    if (_endDate > 0) {
      kodaV2.updateEndDate(editionNumber, _endDate);
    }

    if (_commissionSplitRate > 0) {
      kodaV2.updateOptionalCommission(_editionNumber, _commissionSplitRate, _commissionSplitAddress);
    }

    mintingControls.recordSuccessfulMint(_artist);

    return editionNumber;
  }

  /**
   * @dev Internal function for edition creation
   */
  function _createEdition(
    address _artist,
    bool _enableAuction,
    uint256 _totalAvailable,
    uint256 _priceInWei,
    uint256 _artistCommission,
    string _tokenUri
  )
  internal
  returns (uint256 _editionNumber){

    // Enforce edition size
    require(_totalAvailable > 0, "Must be at least one available in edition");
    require(_totalAvailable <= maxEditionSize, "Must not exceed max edition size");

    // Enforce min price
    require(_priceInWei >= minPricePerEdition, "Price must be greater than minimum");

    // If we are the owner, skip this artists check
    if (msg.sender != owner) {
      // Enforce who can call this
      require(accessControls.isEnabledForAccount(_artist), "Only allowed artists can create editions for now");
    }

    // Find the next edition number we can use
    uint256 editionNumber = getNextAvailableEditionNumber();

    // Attempt to create a new edition
    require(
      _createNewEdition(editionNumber, _artist, _totalAvailable, _priceInWei, _artistCommission, _tokenUri),
      "Failed to create new edition"
    );

    // Enable the auction if desired
    if (_enableAuction) {
      auction.setArtistsControlAddressAndEnabledEdition(editionNumber, _artist);
    }

    // Trigger event
    emit SelfServiceEditionCreated(editionNumber, _artist, _priceInWei, _totalAvailable, _enableAuction);

    return editionNumber;
  }

  /**
   * @dev Internal function for calling external create methods with some none configurable defaults
   */
  function _createNewEdition(
    uint256 _editionNumber,
    address _artist,
    uint256 _totalAvailable,
    uint256 _priceInWei,
    uint256 _artistCommission,
    string _tokenUri
  )
  internal
  returns (bool) {
    return kodaV2.createActiveEdition(
      _editionNumber,
      0x0, // _editionData - no edition data
      1, // _editionType - KODA always type 1
      0,
      0, // _endDate - 0 = MAX unit256
      _artist,
      _artistCommission, // defaults to global property artistCommission if no extra commission split is found
      _priceInWei,
      _tokenUri,
      _totalAvailable
    );
  }

  /**
   * @dev Internal function for dynamically generating the next KODA edition number
   */
  function getNextAvailableEditionNumber() internal returns (uint256 editionNumber) {

    // Get current highest edition and total in the edition
    uint256 highestEditionNumber = kodaV2.highestEditionNumber();
    uint256 totalAvailableEdition = kodaV2.totalAvailableEdition(highestEditionNumber);

    // Add the current highest plus its total, plus 1 as tokens start at 1 not zero
    uint256 nextAvailableEditionNumber = highestEditionNumber.add(totalAvailableEdition).add(1);

    // Round up to next 100, 1000 etc based on max allowed size
    return ((nextAvailableEditionNumber + maxEditionSize - 1) / maxEditionSize) * maxEditionSize;
  }

  /**
   * @dev Sets the KODA address
   * @dev Only callable from owner
   */
  function setKodavV2(IKODAV2SelfServiceEditionCuration _kodaV2) onlyOwner public {
    kodaV2 = _kodaV2;
  }

  /**
   * @dev Sets the KODA auction
   * @dev Only callable from owner
   */
  function setAuction(IKODAAuction _auction) onlyOwner public {
    auction = _auction;
  }

  /**
   * @dev Sets the default KO commission for each edition
   * @dev Only callable from owner
   */
  function setKoCommission(uint256 _koCommission) onlyOwner public {
    koCommission = _koCommission;
  }

  /**
   * @dev Sets the max edition size
   * @dev Only callable from owner
   */
  function setMaxEditionSize(uint256 _maxEditionSize) onlyOwner public {
    maxEditionSize = _maxEditionSize;
  }

  /**
   * @dev Sets minimum price per edition
   * @dev Only callable from owner
   */
  function setMinPricePerEdition(uint256 _minPricePerEdition) onlyOwner public {
    minPricePerEdition = _minPricePerEdition;
  }

  /**
   * @dev Checks to see if the account is currently frozen out
   */
  function isFrozen(address account) public view returns (bool) {
    return mintingControls.canMint(account);
  }

  /**
   * @dev Checks to see if the account can create editions
   */
  function isEnabledForAccount(address account) public view returns (bool) {
    return accessControls.isEnabledForAccount(account);
  }

  /**
   * @dev Checks to see if the account can create editions
   */
  function canCreateAnotherEdition(address account) public view returns (bool) {
    if (!isEnabledForAccount(account)) {
      return false;
    }
    return !mintingControls.canMint(account);
  }

  /**
   * @dev Allows for the ability to extract stuck ether
   * @dev Only callable from owner
   */
  function withdrawStuckEther(address _withdrawalAccount) onlyOwner public {
    require(_withdrawalAccount != address(0), "Invalid address provided");
    _withdrawalAccount.transfer(address(this).balance);
  }
}
