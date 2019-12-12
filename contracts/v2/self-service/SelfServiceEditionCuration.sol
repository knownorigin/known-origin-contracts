pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

interface IKODAV2SelfServiceEditionCuration {

  function createActiveEdition(
    uint256 _editionNumber,
    bytes32 _editionData,
    uint256 _editionType,
    uint256 _startDate,
    uint256 _endDate,
    address _artistAccount,
    uint256 _artistCommission,
    uint256 _priceInWei,
    string _tokenUri,
    uint256 _totalAvailable
  ) external returns (bool);

  function artistsEditions(address _artistsAccount) external returns (uint256[1] _editionNumbers);

  function totalAvailableEdition(uint256 _editionNumber) external returns (uint256);

  function highestEditionNumber() external returns (uint256);
}

interface IKODAAuction {
  function setArtistsControlAddressAndEnabledEdition(uint256 _editionNumber, address _address) external;
}

contract SelfServiceEditionCuration is Ownable, Pausable {
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

  // Default artist commission
  uint256 public artistCommission = 85;

  // When true any existing KO artist can mint their own editions
  bool public openToAllArtist = false;

  // Simple map to only allow certain artist create editions at first
  mapping(address => bool) public allowedArtists;

  // Config which enforces editions to not be over this size
  uint256 public maxEditionSize = 100;

  // When true this will skip the invocation in time period check
  bool public disableInvocationCheck = false;

  // Max number of editions to be created in the time period
  uint256 public maxInvocations = 3;

  // The rolling time period for max number of invocations
  uint256 public maxInvocationsTimePeriod = 1 days;

  // Number of invocations the caller has performed in the time period
  mapping(address => uint256) public invocationsInTimePeriod;

  // When the current time period started
  mapping(address => uint256) public timeOfFirstInvocationInPeriod;

  /**
   * @dev Construct a new instance of the contract
   */
  constructor(IKODAV2SelfServiceEditionCuration _kodaV2, IKODAAuction _auction) public {
    kodaV2 = _kodaV2;
    auction = _auction;
  }

  /**
   * @dev Called by artists, create new edition on the KODA platform
   */
  function createEdition(
    uint256 _totalAvailable,
    uint256 _priceInWei,
    uint256 _startDate,
    string _tokenUri,
    bool _enableAuction
  )
  public
  whenNotPaused
  returns (uint256 _editionNumber)
  {
    validateInvocations();
    return _createEdition(msg.sender, _totalAvailable, _priceInWei, _startDate, _tokenUri, _enableAuction);
  }

  /**
   * @dev Caller by owner, can create editions for other artists
   * @dev Only callable from owner regardless of pause state
   */
  function createEditionFor(
    address _artist,
    uint256 _totalAvailable,
    uint256 _priceInWei,
    uint256 _startDate,
    string _tokenUri,
    bool _enableAuction
  )
  public
  onlyOwner
  returns (uint256 _editionNumber)
  {
    return _createEdition(_artist, _totalAvailable, _priceInWei, _startDate, _tokenUri, _enableAuction);
  }

  /**
   * @dev Internal function for edition creation
   */
  function _createEdition(
    address _artist,
    uint256 _totalAvailable,
    uint256 _priceInWei,
    uint256 _startDate,
    string _tokenUri,
    bool _enableAuction
  )
  internal
  returns (uint256 _editionNumber){

    // Enforce edition size
    require(_totalAvailable > 0, "Must be at least one available in edition");
    require(_totalAvailable <= maxEditionSize, "Must not exceed max edition size");


    // If we are the owner, skip this artists check
    if (msg.sender != owner) {

      // Enforce who can call this
      if (!openToAllArtist) {
        require(allowedArtists[_artist], "Only allowed artists can create editions for now");
      }
    }

    // Find the next edition number we can use
    uint256 editionNumber = getNextAvailableEditionNumber();

    // Attempt to create a new edition
    require(
      _createNewEdition(editionNumber, _artist, _totalAvailable, _priceInWei, _startDate, _tokenUri),
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
    uint256 _startDate,
    string _tokenUri
  )
  internal
  returns (bool) {
    return kodaV2.createActiveEdition(
      _editionNumber,
      0x0, // _editionData - no edition data
      1, // _editionType - KODA always type 1
      _startDate,
      0, // _endDate - 0 = MAX unit256
      _artist,
      artistCommission,
      _priceInWei,
      _tokenUri,
      _totalAvailable
    );
  }

  function validateInvocations() internal {
    if (disableInvocationCheck) {
      return;
    }
    uint256 invocationPeriodStart = timeOfFirstInvocationInPeriod[msg.sender];

    // If we are new to this process or its been cleared, skip the check
    if (invocationPeriodStart != 0) {

      // Work out how much time has passed
      uint256 timePassedInPeriod = block.timestamp - invocationPeriodStart;

      // If we are still in this time period
      if (timePassedInPeriod < maxInvocationsTimePeriod) {

        uint256 invocations = invocationsInTimePeriod[msg.sender];

        // Ensure the number of invocations does not exceed the max number of invocations allowed
        require(invocations <= maxInvocations, "Exceeded max invocations for time period");

        // Update the invocations for this period if passed validation check
        invocationsInTimePeriod[msg.sender] = invocations + 1;

      } else {
        // if we have passed the time period simple clear out the fields and start the period again
        invocationsInTimePeriod[msg.sender] = 1;
        timeOfFirstInvocationInPeriod[msg.sender] = block.number;
      }

    } else {
      // initial the counters if not used before
      invocationsInTimePeriod[msg.sender] = 1;
      timeOfFirstInvocationInPeriod[msg.sender] = block.number;
    }
  }

  /**
   * @dev Internal function for dynamically generating the next KODA edition number
   */
  function getNextAvailableEditionNumber()
  internal
  returns (uint256 editionNumber) {

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
   * @dev Sets the default commission for each edition
   * @dev Only callable from owner
   */
  function setArtistCommission(uint256 _artistCommission) onlyOwner public {
    artistCommission = _artistCommission;
  }

  /**
   * @dev Controls is the contract is open to all
   * @dev Only callable from owner
   */
  function setOpenToAllArtist(bool _openToAllArtist) onlyOwner public {
    openToAllArtist = _openToAllArtist;
  }

  /**
   * @dev Controls who can call this contract
   * @dev Only callable from owner
   */
  function setAllowedArtist(address _artist, bool _allowed) onlyOwner public {
    allowedArtists[_artist] = _allowed;
  }

  /**
   * @dev Sets the max edition size
   * @dev Only callable from owner
   */
  function setMaxEditionSize(uint256 _maxEditionSize) onlyOwner public {
    maxEditionSize = _maxEditionSize;
  }

  /**
   * @dev Sets the max invocations
   * @dev Only callable from owner
   */
  function setMaxInvocations(uint256 _maxInvocations) onlyOwner public {
    maxInvocations = _maxInvocations;
  }

  /**
   * @dev Sets the disable invocation check, when true the invocation in time period check is skipped
   * @dev Only callable from owner
   */
  function setDisableInvocationCheck(bool _disableInvocationCheck) onlyOwner public {
    disableInvocationCheck = _disableInvocationCheck;
  }

  /**
   * @dev Checks to see if the account can mint more assets
   */
  function canCreateAnotherEdition(address account) public view returns (bool) {
    return isEnabledForAccount(account) && invocationsInTimePeriod[account] <= maxInvocations;
  }

  /**
   * @dev Checks to see if the account can create editions
   */
  function isEnabledForAccount(address account) public view returns (bool) {
    if (openToAllArtist) {
      return true;
    }
    return allowedArtists[account];
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
