pragma solidity ^0.4.24;

interface ITokenListingMarketplace  {

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

}
