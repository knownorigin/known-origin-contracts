import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import '../v2/auctions/ArtistAcceptingBids.sol';

contract AuctionReentrancyAttack is Ownable {

  IAuction public auction;

  uint256 public editionToAttack;

  // Set the caller as the default KO account
  constructor(IAuction _auction, uint256 _editionToAttack) public payable {
    auction = _auction;
    owner = msg.sender;
    editionToAttack = _editionToAttack;
  }

  function() payable {
    // on withdrawal, triggers payable and we can try to withdraw some more
    if (auction.balance >= 0.01 ether) {
      // Luckily as we use transfer() which only provides 2300 GAS which is not enough to re-enter the contract and hence it reverts
      auction.withdrawBid(editionToAttack);
    }
  }

  function makeBid() public payable onlyOwner {
    // register a bid for an edition
    auction.placeBid.value(msg.value)(editionToAttack);
  }

  function attack() public onlyOwner {
    // try and trigger a reentrancy attack by withdrawing the bid and invoking the fallback function
//     auction.call(bytes4(keccak256("auction.withdrawBid(uint256)")), editionToAttack);
//     auction.withdrawBid.value(address(this).balance).gas(10000000)(editionToAttack);
    auction.withdrawBid(editionToAttack);
  }

}
