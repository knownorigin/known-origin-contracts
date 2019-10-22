const assertRevert = require('../../../helpers/assertRevert');
const etherToWei = require('../../../helpers/etherToWei');
const _ = require('lodash');
const bnChai = require('bn-chai');

const getBalance = require('../../../helpers/getBalance');
const toBN = require('../../../helpers/toBN');

const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const ArtistAcceptingBids = artifacts.require('ArtistAcceptingBids');
const AuctionReentrancyAttack = artifacts.require('AuctionReentrancyAttack');

require('chai')
  .use(require('chai-as-promised'))
  .use(bnChai(web3.utils.BN))
  .should();

contract('ArtistAcceptingBids - re-entrency tests', function (accounts) {

  const ROLE_MINTER = 2;

  const _owner = accounts[0];
  const koCommission = accounts[1];

  const artistAccount1 = accounts[2];

  const bidder1 = accounts[4];

  const attacker = accounts[6];

  const editionNumber1 = 100000;
  const editionNumber2 = 200000;

  const editionType = 1;
  const editionData = web3.utils.asciiToHex("editionData");
  const editionTokenUri = "edition1";
  const edition1Price = etherToWei(0.1);

  const artistCommission = 76;
  const totalAvailable = 5;

  beforeEach(async function () {
    // Create contracts
    this.koda = await KnownOriginDigitalAssetV2.new({from: _owner});
    this.auction = await ArtistAcceptingBids.new(this.koda.address, {from: _owner});

    // Load the attack contract with some eth as well in case we need to use it
    this.attackContract = await AuctionReentrancyAttack.new(this.auction.address, editionNumber1, {
      from: attacker,
      value: etherToWei(0.1)
    });

    // Update the commission account to be something different than owner
    await this.auction.setKoCommissionAccount(koCommission, {from: _owner});

    // Whitelist the auction contract
    await this.koda.addAddressToAccessControl(this.auction.address, ROLE_MINTER, {from: _owner});

    // Grab the min bid amount
    this.minBidAmount = await this.auction.minBidAmount();
  });

  beforeEach(async function () {
    // Create 2 editions
    await this.koda.createActiveEdition(editionNumber1, editionData, editionType, 0, 0, artistAccount1, artistCommission, edition1Price, editionTokenUri, totalAvailable, {from: _owner});
    await this.koda.createActiveEdition(editionNumber2, editionData, editionType, 0, 0, artistAccount1, artistCommission, edition1Price, editionTokenUri, totalAvailable, {from: _owner});

    // Enable the edition and artist
    await this.auction.setArtistsControlAddressAndEnabledEdition(editionNumber1, artistAccount1, {from: _owner});
    await this.auction.setArtistsControlAddressAndEnabledEdition(editionNumber2, artistAccount1, {from: _owner});
  });

  describe('withdrawBid() - testing for re-entrancy', async function () {

    beforeEach(async function () {
      // Place a bid on the edition 1
      await this.attackContract.makeBid({from: attacker, value: this.minBidAmount});

      // Load up the auction contract with more ether, specifically for edition 2 which we can demonstrate the attack against
      await this.auction.placeBid(editionNumber2, {from: bidder1, value: this.minBidAmount.mul(toBN(4))});
    });

    it('total balance shows for both edition 1 & 2', async function () {
      let auctionBalance = await getBalance(this.auction.address);
      // should have original edition 1 bid plus edition 2 bid ether
      auctionBalance.should.be.eq.BN(this.minBidAmount.mul(toBN(5)));
    });

    it('attacker contract has balance', async function () {
      let attackContractBalance = await getBalance(this.attackContract.address);
      attackContractBalance.should.be.eq.BN(etherToWei(0.1));
    });

    it('edition 1 bid has been placed, attack contract is the winner', async function () {
      let details = await this.auction.highestBidForEdition(editionNumber1);
      details[0].should.be.equal(this.attackContract.address);
      details[1].should.be.eq.BN(this.minBidAmount);
    });

    it('edition 2 bid has been placed', async function () {
      let details = await this.auction.highestBidForEdition(editionNumber2);
      details[0].should.be.equal(bidder1);
      details[1].should.be.eq.BN(this.minBidAmount.mul(toBN(4)));
    });

    it('attempt hack - can withdraw more ether than placed in', async function () {
      /*
       * Since we use .transfer() internally to refund the bid amount,
       * we can not re-enter the contract as its limited to a maximum of 2300 gas which isnt enough
       * to re-enter the contract and extract more ether!
       */
      await assertRevert(this.attackContract.attack({from: attacker}));

      // Auction balance unchanged
      const auctionBalance = await getBalance(this.auction.address);
      auctionBalance.should.be.eq.BN(this.minBidAmount.mul(toBN(5)));

      // Attacker balance unchanged
      let attackContractBalance = await getBalance(this.attackContract.address);
      attackContractBalance.should.be.eq.BN(etherToWei(0.1));
    });
  });

});
