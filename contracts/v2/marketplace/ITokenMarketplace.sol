pragma solidity ^0.4.24;

interface ITokenMarketplace {

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

  function placeBid(uint256 _tokenId) payable external returns (bool success);

  function withdrawBid(uint256 _tokenId) external returns (bool success);

  function acceptBid(uint256 _tokenId) external returns (uint256 tokenId);

  function rejectBid(uint256 _tokenId) external returns (bool success);

  function enableAuction(uint256 _tokenId) external returns (bool success);

  function disableAuction(uint256 _tokenId) external returns (bool success);
}
