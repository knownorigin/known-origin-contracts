pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/access/Whitelist.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../ReentrancyGuard.sol";

interface IKODAV2Methods {
  function ownerOf(uint256 _tokenId) external view returns (address _owner);

  function exists(uint256 _tokenId) external view returns (bool _exists);

  function editionOfTokenId(uint256 _tokenId) external view returns (uint256 tokenId);

  function artistCommission(uint256 _tokenId) external view returns (address _artistAccount, uint256 _artistCommission);

  function editionOptionalCommission(uint256 _tokenId) external view returns (uint256 _rate, address _recipient);

  function safeTransferFrom(address _from, address _to, uint256 _tokenId) external;
}

// Based on ITokenMarketplace.sol
contract TokenMarketplaceV2 is Whitelist, Pausable, ReentrancyGuard {
  using SafeMath for uint256;

  event UpdatePlatformPercentageFee(uint256 _oldPercentage, uint256 _newPercentage);
  event UpdateRoyaltyPercentageFee(uint256 _oldPercentage, uint256 _newPercentage);
  event UpdateMinBidAmount(uint256 minBidAmount);

  event TokenListed(
    uint256 indexed _tokenId,
    address indexed _seller,
    uint256 _price
  );

  event TokenDeListed(
    uint256 indexed _tokenId
  );

  event TokenPurchased(
    uint256 indexed _tokenId,
    address indexed _buyer,
    address indexed _seller,
    uint256 _price
  );

  event BidPlaced(
    uint256 indexed _tokenId,
    address indexed _currentOwner,
    address indexed _bidder,
    uint256 _amount
  );

  event BidWithdrawn(
    uint256 indexed _tokenId,
    address indexed _bidder
  );

  event BidAccepted(
    uint256 indexed _tokenId,
    address indexed _currentOwner,
    address indexed _bidder,
    uint256 _amount
  );

  event BidRejected(
    uint256 indexed _tokenId,
    address indexed _currentOwner,
    address indexed _bidder,
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

  event ListingEnabled(
    uint256 indexed _tokenId
  );

  event ListingDisabled(
    uint256 indexed _tokenId
  );

  struct Offer {
    address bidder;
    uint256 offer;
  }

  struct Listing {
    uint256 price;
    address seller;
  }

  // Min increase in bid/list amount
  uint256 public minBidAmount = 0.04 ether;

  // Interface into the KODA world
  IKODAV2Methods public kodaAddress;

  // KO account which can receive commission
  address public koCommissionAccount;

  uint256 public artistRoyaltyPercentage = 100;
  uint256 public platformFeePercentage = 25;

  // Token ID to Offer mapping
  mapping(uint256 => Offer) public offers;

  // Token ID to Listing
  mapping(uint256 => Listing) public listings;

  // Explicitly disable sales for specific tokens
  mapping(uint256 => bool) public disabledTokens;

  // Explicitly disable listings for specific tokens
  mapping(uint256 => bool) public disabledListings;

  ///////////////
  // Modifiers //
  ///////////////

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
  constructor(IKODAV2Methods _kodaAddress, address _koCommissionAccount) public {
    kodaAddress = _kodaAddress;
    koCommissionAccount = _koCommissionAccount;
    super.addAddressToWhitelist(msg.sender);
  }

  //////////////////////////
  // User Bidding Actions //
  //////////////////////////

  function placeBid(uint256 _tokenId)
  public
  payable
  whenNotPaused
  nonReentrant
  onlyWhenTokenExists(_tokenId)
  onlyWhenBidOverMinAmount(_tokenId)
  onlyWhenTokenAuctionEnabled(_tokenId)
  {
    require(!isContract(msg.sender), "Unable to place a bid as a contract");
    _refundHighestBidder(_tokenId);

    offers[_tokenId] = Offer({bidder : msg.sender, offer : msg.value});

    address currentOwner = kodaAddress.ownerOf(_tokenId);

    emit BidPlaced(_tokenId, currentOwner, msg.sender, msg.value);
  }

  function withdrawBid(uint256 _tokenId)
  public
  whenNotPaused
  nonReentrant
  onlyWhenTokenExists(_tokenId)
  onlyWhenOfferOwner(_tokenId)
  {
    _refundHighestBidder(_tokenId);

    emit BidWithdrawn(_tokenId, msg.sender);
  }

  function rejectBid(uint256 _tokenId)
  public
  whenNotPaused
  nonReentrant
  {
    address currentOwner = kodaAddress.ownerOf(_tokenId);
    require(currentOwner == msg.sender, "Not token owner");

    uint256 currentHighestBiddersAmount = offers[_tokenId].offer;
    require(currentHighestBiddersAmount > 0, "No offer open");

    address currentHighestBidder = offers[_tokenId].bidder;

    _refundHighestBidder(_tokenId);

    emit BidRejected(_tokenId, currentOwner, currentHighestBidder, currentHighestBiddersAmount);
  }

  function acceptBid(uint256 _tokenId, uint256 _acceptedAmount)
  public
  whenNotPaused
  nonReentrant
  {
    address currentOwner = kodaAddress.ownerOf(_tokenId);
    require(currentOwner == msg.sender, "Not token owner");

    Offer storage offer = offers[_tokenId];

    uint256 winningOffer = offer.offer;

    // Check valid offer and offer not replaced whilst inflight
    require(winningOffer > 0 && _acceptedAmount >= winningOffer, "Offer amount not satisfied");

    address winningBidder = offer.bidder;

    delete offers[_tokenId];

    // Get edition no.
    uint256 editionNumber = kodaAddress.editionOfTokenId(_tokenId);

    _handleFunds(editionNumber, winningOffer, currentOwner);

    kodaAddress.safeTransferFrom(msg.sender, winningBidder, _tokenId);

    emit BidAccepted(_tokenId, currentOwner, winningBidder, winningOffer);
  }

  function _refundHighestBidder(uint256 _tokenId) internal {
    // Get current highest bidder
    address currentHighestBidder = offers[_tokenId].bidder;

    if (currentHighestBidder != address(0)) {

      // Get current highest bid amount
      uint256 currentHighestBiddersAmount = offers[_tokenId].offer;

      if (currentHighestBiddersAmount > 0) {

        // Clear out highest bidder
        delete offers[_tokenId];

        // Refund it
        currentHighestBidder.transfer(currentHighestBiddersAmount);
      }
    }
  }

  //////////////////////////
  // User Listing Actions //
  //////////////////////////

  function listToken(uint256 _tokenId, uint256 _listingPrice)
  public
  whenNotPaused {
    require(!disabledListings[_tokenId], "Listing disabled");

    // Check ownership before listing
    address tokenOwner = kodaAddress.ownerOf(_tokenId);
    require(tokenOwner == msg.sender, "Not token owner");

    // Check price over min bid
    require(_listingPrice >= minBidAmount, "Listing price not enough");

    // List the token
    listings[_tokenId] = Listing({
    price : _listingPrice,
    seller : msg.sender
    });

    emit TokenListed(_tokenId, msg.sender, _listingPrice);
  }

  function delistToken(uint256 _tokenId)
  public
  whenNotPaused {

    // check listing found
    require(listings[_tokenId].seller != address(0), "No listing found");

    // check owner is msg.sender
    require(kodaAddress.ownerOf(_tokenId) == msg.sender, "Only the current owner can delist");

    _delistToken(_tokenId);
  }

  function buyToken(uint256 _tokenId)
  public
  payable
  nonReentrant
  whenNotPaused {
    Listing storage listing = listings[_tokenId];

    // check token is listed
    require(listing.seller != address(0), "No listing found");

    // check current owner is the lister as it may have changed hands
    address currentOwner = kodaAddress.ownerOf(_tokenId);
    require(listing.seller == currentOwner, "Listing not valid, token owner has changed");

    // check listing satisfied
    uint256 listingPrice = listing.price;
    require(msg.value == listingPrice, "List price not satisfied");

    // Get edition no.
    uint256 editionNumber = kodaAddress.editionOfTokenId(_tokenId);

    // refund any open offers on it
    Offer storage offer = offers[_tokenId];
    _refundHighestBidder(_tokenId);

    // split funds
    _handleFunds(editionNumber, listingPrice, currentOwner);

    // transfer token to buyer
    kodaAddress.safeTransferFrom(currentOwner, msg.sender, _tokenId);

    // de-list the token
    _delistToken(_tokenId);

    // Fire confirmation event
    emit TokenPurchased(_tokenId, msg.sender, currentOwner, listingPrice);
  }

  function _delistToken(uint256 _tokenId) private {
    delete listings[_tokenId];

    emit TokenDeListed(_tokenId);
  }

  ////////////////////
  // Funds handling //
  ////////////////////

  function _handleFunds(uint256 _editionNumber, uint256 _offer, address _currentOwner) internal {

    // Get existing artist commission
    (address artistAccount, uint256 artistCommissionRate) = kodaAddress.artistCommission(_editionNumber);

    // Get existing optional commission
    (uint256 optionalCommissionRate, address optionalCommissionRecipient) = kodaAddress.editionOptionalCommission(_editionNumber);

    _splitFunds(artistAccount, artistCommissionRate, optionalCommissionRecipient, optionalCommissionRate, _offer, _currentOwner);
  }

  function _splitFunds(
    address _artistAccount,
    uint256 _artistCommissionRate,
    address _optionalCommissionRecipient,
    uint256 _optionalCommissionRate,
    uint256 _offer,
    address _currentOwner
  ) internal {

    // Work out total % of royalties to payout = creator royalties + KO commission
    uint256 totalCommissionPercentageToPay = platformFeePercentage.add(artistRoyaltyPercentage);

    // Send current owner majority share of the offer
    uint256 totalToSendToOwner = _offer.sub(
      _offer.div(1000).mul(totalCommissionPercentageToPay)
    );
    _currentOwner.transfer(totalToSendToOwner);

    // Send % to KO
    uint256 koCommission = _offer.div(1000).mul(platformFeePercentage);
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
    uint256 _scaledUpCommission = _artistCommissionRate.mul(10 ** 18);

    // work out % of royalties total to split e.g. 43 / 85 = 50.5882353%
    uint256 primaryArtistPercentage = _scaledUpCommission.div(_totalCollaboratorsRate);

    uint256 totalPrimaryRoyaltiesToArtist = _remainingRoyalties.mul(primaryArtistPercentage).div(10 ** 18);
    _artistAccount.transfer(totalPrimaryRoyaltiesToArtist);

    uint256 remainingRoyaltiesToCollaborator = _remainingRoyalties.sub(totalPrimaryRoyaltiesToArtist);
    _optionalCommissionRecipient.transfer(remainingRoyaltiesToCollaborator);
  }

  ///////////////////
  // Query Methods //
  ///////////////////

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

  function determineSaleValues(uint256 _tokenId) external view returns (uint256 _sellerTotal, uint256 _platformFee, uint256 _royaltyFee) {
    Offer memory offer = offers[_tokenId];
    uint256 offerValue = offer.offer;
    uint256 fee = offerValue.div(1000).mul(platformFeePercentage);
    uint256 royalties = offerValue.div(1000).mul(artistRoyaltyPercentage);

    return (
    offer.offer.sub(fee).sub(royalties),
    fee,
    royalties
    );
  }

  function tokenListingDetails(uint256 _tokenId) external view returns (uint256 _price, address _lister, address _currentOwner) {
    Listing memory listing = listings[_tokenId];
    return (
    listing.price,
    listing.seller,
    kodaAddress.ownerOf(_tokenId)
    );
  }

  function isContract(address account) internal view returns (bool) {
    // This method relies in extcodesize, which returns 0 for contracts in
    // construction, since the code is only stored at the end of the
    // constructor execution.
    uint256 size;
    // solhint-disable-next-line no-inline-assembly
    assembly {size := extcodesize(account)}
    return size > 0;
  }

  ///////////////////
  // Admin Actions //
  ///////////////////

  function disableAuction(uint256 _tokenId)
  public
  onlyIfWhitelisted(msg.sender)
  {
    _refundHighestBidder(_tokenId);

    disabledTokens[_tokenId] = true;

    emit AuctionDisabled(_tokenId, msg.sender);
  }

  function enableAuction(uint256 _tokenId)
  public
  onlyIfWhitelisted(msg.sender)
  {
    _refundHighestBidder(_tokenId);

    disabledTokens[_tokenId] = false;

    emit AuctionEnabled(_tokenId, msg.sender);
  }

  function disableListing(uint256 _tokenId)
  public
  onlyIfWhitelisted(msg.sender)
  {
    _delistToken(_tokenId);

    disabledListings[_tokenId] = true;

    emit ListingDisabled(_tokenId);
  }

  function enableListing(uint256 _tokenId)
  public
  onlyIfWhitelisted(msg.sender)
  {
    disabledListings[_tokenId] = false;

    emit ListingEnabled(_tokenId);
  }

  function setMinBidAmount(uint256 _minBidAmount) onlyIfWhitelisted(msg.sender) public {
    minBidAmount = _minBidAmount;
    emit UpdateMinBidAmount(minBidAmount);
  }

  function setKodavV2(IKODAV2Methods _kodaAddress) onlyIfWhitelisted(msg.sender) public {
    kodaAddress = _kodaAddress;
  }

  function setKoCommissionAccount(address _koCommissionAccount) public onlyIfWhitelisted(msg.sender) {
    require(_koCommissionAccount != address(0), "Invalid address");
    koCommissionAccount = _koCommissionAccount;
  }

  function setArtistRoyaltyPercentage(uint256 _artistRoyaltyPercentage) public onlyIfWhitelisted(msg.sender) {
    emit UpdateRoyaltyPercentageFee(artistRoyaltyPercentage, _artistRoyaltyPercentage);
    artistRoyaltyPercentage = _artistRoyaltyPercentage;
  }

  function setPlatformPercentage(uint256 _platformFeePercentage) public onlyIfWhitelisted(msg.sender) {
    emit UpdatePlatformPercentageFee(platformFeePercentage, _platformFeePercentage);
    platformFeePercentage = _platformFeePercentage;
  }
}
