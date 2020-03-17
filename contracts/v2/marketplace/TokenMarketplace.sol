pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/access/rbac/Roles.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/access/Whitelist.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../v1/ERC721Receiver.sol";

interface ITokenMarketplace {

  event BidPlaced(
    address indexed _bidder,
    uint256 indexed _tokenId,
    uint256 _amount
  );

  event BidIncreased(
    address indexed _bidder,
    uint256 indexed _tokenId,
    uint256 _amount
  );

  event BidWithdrawn(
    address indexed _bidder,
    uint256 indexed _tokenId
  );

  event BidAccepted(
    address indexed _bidder,
    uint256 indexed _tokenId,
    uint256 _amount
  );

  event BidRejected(
    address indexed _caller,
    address indexed _bidder,
    uint256 indexed _tokenId,
    uint256 _amount
  );

  event AuctionEnabled(
    uint256 indexed _tokenId,
    address indexed _auctioneer
  );

  event AuctionDisabled(
    uint256 indexed _tokenId,
    address indexed _auctioneer
  );

  function placeBid(uint256 _tokenId) payable external returns (bool success);

  function increaseBid(uint256 _tokenId) payable external returns (bool success);

  function withdrawBid(uint256 _tokenId) external returns (bool success);

  function acceptBid(uint256 _tokenId) external returns (uint256 tokenId);

  function rejectBid(uint256 _tokenId) external returns (bool success);

  function enableAuction(uint256 _tokenId) external returns (bool success);

  function disableAuction(uint256 _tokenId) external returns (bool success);
}

interface IKODAV2 {
  function ownerOf(uint256 _tokenId) external view returns (address _owner);

  function exists(uint256 _tokenId) external view returns (bool _exists);

  function editionOfTokenId(uint256 _tokenId) external view returns (uint256 tokenId);

  function artistCommission(uint256 _tokenId) external view returns (address _artistAccount, uint256 _artistCommission);

  function editionOptionalCommission(uint256 _tokenId) external view returns (uint256 _rate, address _recipient);

  function safeTransferFrom(address _from, address _to, uint256 _tokenId) external;
}

/**
 * @title
 * @dev
 *
 * Goals
 * Allow Token X to be placed on the market
 *
 *
 */
contract TokenMarketplace is Whitelist, Pausable, ERC721Receiver, ITokenMarketplace {
  using SafeMath for uint256;

  event Received(address _address, uint256 _tokenId, bytes _data, uint256 _gas);

  struct Offer {
    address bidder;
    uint256 offer;
  }

  // Min increase in bid amount
  uint256 public minBidAmount = 0.04 ether;

  // Interface into the KODA world
  IKODAV2 public kodaAddress;

  // KO account which can receive commission
  address public koCommissionAccount;

  // 50 = 5%
  uint256 public defaultArtistRoyaltyPercentage = 50;

  // 30 = 3%
  uint256 public defaultKOPercentage = 30;

  // Token ID to Offer mapping
  mapping(uint256 => Offer) offers;

  mapping(uint256 => bool) disabledTokens;

  ///////////////
  // Modifiers //
  ///////////////

  modifier onlyTokenOwner(uint256 _tokenId) {
    require(kodaAddress.ownerOf(_tokenId) == msg.sender, "Not token owner");
    _;
  }

  modifier onlyWhenOfferOwner(uint256 _tokenId) {
    require(offers[_tokenId].bidder == msg.sender, "Not offer maker");
    _;
  }

  modifier onlyWhenTokenExists(uint256 _tokenId) {
    require(kodaAddress.exists(_tokenId), "Token does not exist");
    _;
  }

  modifier onlyWhenBidOverMinAmount(uint256 _tokenId) {
    require(msg.value >= offers[_tokenId].offer.add(minBidAmount), "Offer not enough");
    _;
  }

  modifier onlyWhenTokenAuctionEnabled(uint256 _tokenId) {
    require(!disabledTokens[_tokenId], "Token not enabled for offers");
    _;
  }

  /////////////////
  // Constructor //
  /////////////////

  // Set the caller as the default KO account
  constructor(IKODAV2 _kodaAddress, address _koCommissionAccount) public {
    kodaAddress = _kodaAddress;
    koCommissionAccount = _koCommissionAccount;
    super.addAddressToWhitelist(msg.sender);
  }

  //////////////////
  // User Actions //
  //////////////////

  function placeBid(uint256 _tokenId)
  public
  payable
  whenNotPaused
  onlyWhenTokenExists(_tokenId)
  onlyWhenBidOverMinAmount(_tokenId)
  onlyWhenTokenAuctionEnabled(_tokenId)
  {
    _refundHighestBidder(_tokenId);

    offers[_tokenId] = Offer(msg.sender, msg.value);

    emit BidPlaced(msg.sender, _tokenId, msg.value);
  }

  function increaseBid(uint256 _tokenId)
  public
  payable
  whenNotPaused
  onlyWhenOfferOwner(_tokenId)
  onlyWhenBidOverMinAmount(_tokenId)
  onlyWhenTokenAuctionEnabled(_tokenId)
  {
    offers[_tokenId].offer = offers[_tokenId].offer.add(msg.value);

    emit BidIncreased(msg.sender, _tokenId, msg.value);
  }

  function withdrawBid(uint256 _tokenId)
  public
  whenNotPaused
  onlyWhenTokenExists(_tokenId)
  onlyWhenOfferOwner(_tokenId)
  onlyWhenTokenAuctionEnabled(_tokenId)
  {

    _refundHighestBidder(_tokenId);

    emit BidWithdrawn(msg.sender, _tokenId);
  }

  function rejectBid(uint256 _tokenId)
  public
  whenNotPaused
  onlyTokenOwner(_tokenId)
  {
    // FIXME - check open offer set

    address currentHighestBidder = offers[_tokenId].bidder;
    uint256 currentHighestBiddersAmount = offers[_tokenId].offer;

    _refundHighestBidder(_tokenId);

    emit BidRejected(msg.sender, currentHighestBidder, _tokenId, currentHighestBiddersAmount);
  }

  function acceptBid(uint256 _tokenId)
  public
  whenNotPaused
  {
    // FIXME - check open offer set

    address currentOwner = kodaAddress.ownerOf(_tokenId);
    require(currentOwner == msg.sender, "Not token owner");

    uint256 winningOffer = offers[_tokenId].offer;
    address winningBidder = offers[_tokenId].bidder;

    // Get edition no.
    uint256 editionNumber = kodaAddress.editionOfTokenId(_tokenId);

    _handleFunds(editionNumber, winningOffer, currentOwner);

    kodaAddress.safeTransferFrom(msg.sender, winningBidder, _tokenId);

    emit BidAccepted(winningBidder, _tokenId, winningOffer);

    delete offers[_tokenId];
  }

  function tokenOffer(uint256 _tokenId) external view returns (address _bidder, uint256 _offer, address _owner, bool _enabled, bool _paused) {
    Offer memory offer = offers[_tokenId];
    return (
    offer.bidder,
    offer.offer,
    kodaAddress.ownerOf(_tokenId),
    !disabledTokens[_tokenId],
    paused
    );
  }

  /**
   * Returns funds of the previous highest bidder back to them if present
   */
  function _refundHighestBidder(uint256 _tokenId) internal {
    // Get current highest bidder
    address currentHighestBidder = offers[_tokenId].bidder;

    // Get current highest bid amount
    uint256 currentHighestBiddersAmount = offers[_tokenId].offer;

    if (currentHighestBidder != address(0) && currentHighestBiddersAmount > 0) {

      // Clear out highest bidder
      delete offers[_tokenId];

      // Refund it
      currentHighestBidder.transfer(currentHighestBiddersAmount);
    }
  }

  function _handleFunds(uint256 _editionNumber, uint256 _offer, address _currentOwner) internal {

    // Get existing artist commission
    (address artistAccount, uint256 artistCommissionRate) = kodaAddress.artistCommission(_editionNumber);

    // Get existing optional commission
    (uint256 optionalCommissionRate, address optionalCommissionRecipient) = kodaAddress.editionOptionalCommission(_editionNumber);

    _splitFunds(artistAccount, artistCommissionRate, optionalCommissionRecipient, optionalCommissionRate, _offer, _currentOwner);
  }

  event Debug(uint256 indexed value, string name);

  function _splitFunds(
    address _artistAccount,
    uint256 _artistCommissionRate,
    address _optionalCommissionRecipient,
    uint256 _optionalCommissionRate,
    uint256 _offer,
    address _currentOwner
  ) internal {

    // Work out total % of royalties to payout = creator royalties + KO commission
    uint256 totalCommissionPercentageToPay = defaultKOPercentage.add(defaultArtistRoyaltyPercentage);

    // Send current owner majority share of the offer
    uint256 totalToSendToOwner = _offer.sub(
      _offer.div(1000).mul(totalCommissionPercentageToPay)
    );
    _currentOwner.transfer(totalToSendToOwner);

    // Send % to KO
    uint256 koCommission = _offer.div(1000).mul(defaultKOPercentage);
    koCommissionAccount.transfer(koCommission);

    // Send to seller minus royalties and commission
    uint256 remainingRoyalties = _offer.sub(koCommission).sub(totalToSendToOwner);

    if (_optionalCommissionRecipient == address(0)) {
      // After KO and Seller - send the rest to the original artist
      _artistAccount.transfer(remainingRoyalties);
    } else {
      _handleOptionalSplits(_artistAccount, _artistCommissionRate, _optionalCommissionRecipient, _optionalCommissionRate, remainingRoyalties);
    }
  }

  function _handleOptionalSplits(
    address _artistAccount,
    uint256 _artistCommissionRate,
    address _optionalCommissionRecipient,
    uint256 _optionalCommissionRate,
    uint256 _remainingRoyalties
  ) internal {

    uint256 _totalCollaboratorsRate = _artistCommissionRate.add(_optionalCommissionRate);
    emit Debug(_totalCollaboratorsRate, "_totalCollaboratorsRate");

    // work out % of royalties total to split e.g. 43 / 85 = 50.5882353%
    uint256 primaryArtistPercentage = (_artistCommissionRate.mul(10 ^ 18)).div(_totalCollaboratorsRate);
    emit Debug(primaryArtistPercentage, "primaryArtistPercentage");

    uint256 totalPrimaryRoyaltiesToArtist = _remainingRoyalties.div(10 ^ 18).mul(primaryArtistPercentage);
    emit Debug(totalPrimaryRoyaltiesToArtist, "totalPrimaryRoyaltiesToArtist");
    _artistAccount.transfer(totalPrimaryRoyaltiesToArtist);

    uint256 remainingRoyaltiesToCollaborator = _remainingRoyalties.sub(totalPrimaryRoyaltiesToArtist);
    emit Debug(remainingRoyaltiesToCollaborator, "remainingRoyaltiesToCollaborator");
    _optionalCommissionRecipient.transfer(remainingRoyaltiesToCollaborator);
  }

  ///////////////////
  // Admin Actions //
  ///////////////////

  function disableAuction(uint256 _tokenId)
  public
  onlyIfWhitelisted(msg.sender)
  onlyWhenTokenExists(_tokenId)
  {
    _refundHighestBidder(_tokenId);
    disabledTokens[_tokenId] = true;

    emit AuctionDisabled(_tokenId, msg.sender);
  }

  function enableAuction(uint256 _tokenId)
  public
  onlyIfWhitelisted(msg.sender)
  onlyWhenTokenExists(_tokenId)
  {
    _refundHighestBidder(_tokenId);
    disabledTokens[_tokenId] = false;

    emit AuctionEnabled(_tokenId, msg.sender);
  }

  function onERC721Received(address _address, uint256 _tokenId, bytes _data) public returns (bytes4) {
    Received(_address, _tokenId, _data, msg.gas);
    return ERC721_RECEIVED;
  }

  function setMinBidAmount(uint256 _minBidAmount) onlyIfWhitelisted(msg.sender) public {
    minBidAmount = _minBidAmount;
  }

  function setKodavV2(IKODAV2 _kodaAddress) onlyIfWhitelisted(msg.sender) public {
    kodaAddress = _kodaAddress;
  }

  function setKoCommissionAccount(address _koCommissionAccount) public onlyIfWhitelisted(msg.sender) {
    require(_koCommissionAccount != address(0), "Invalid address");
    koCommissionAccount = _koCommissionAccount;
  }
}
