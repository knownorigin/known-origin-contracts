const getGasCosts = require('../../../helpers/getGasCosts');
const getBalance = require('../../../helpers/getBalance');
const toBN = require('../../../helpers/toBN');
const assertRevert = require('../../../helpers/assertRevert');
const etherToWei = require('../../../helpers/etherToWei');
const bnChai = require('bn-chai');

const _ = require('lodash');

const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const TokenMarketplace = artifacts.require('TokenMarketplace');

require('chai')
  .use(require('chai-as-promised'))
  .use(bnChai(web3.utils.BN))
  .should();

contract.only('TokenMarketplace tests', function (accounts) {

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const ROLE_MINTER = 2;

  const _owner = accounts[0];
  const koCommission = accounts[1];

  const artistAccount1 = accounts[2];

  const bidder1 = accounts[3];
  const bidder2 = accounts[4];
  const bidder3 = accounts[5];

  const owner1 = accounts[6];
  const owner2 = accounts[7];
  const owner3 = accounts[8];

  const editionNumber1 = 100000;
  const editionType = 1;
  const editionData1 = web3.utils.asciiToHex("editionData1");
  const editionTokenUri1 = "edition1";
  const edition1Price = etherToWei(0.1);

  const artistCommission = toBN(76);
  const totalAvailable = 5;

  const token1 = 100001;
  const token2 = 100002;
  const token3 = 100003;

  beforeEach(async () => {
    // Create contracts
    this.koda = await KnownOriginDigitalAssetV2.new({from: _owner});
    this.marketplace = await TokenMarketplace.new(this.koda.address, _owner, {from: _owner});

    // Update the commission account to be something different than owner
    await this.marketplace.setKoCommissionAccount(koCommission, {from: _owner});

    // Whitelist the marketplace contract
    await this.koda.addAddressToAccessControl(this.marketplace.address, ROLE_MINTER, {from: _owner});

    // Grab the min bid amount
    this.minBidAmount = toBN(await this.marketplace.minBidAmount());
  });

  beforeEach(async () => {
    // Create a new edition
    await this.koda.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount1, artistCommission, edition1Price, editionTokenUri1, totalAvailable, {from: _owner});

    // Give each owner a token
    await this.koda.mint(owner1, editionNumber1, {from: _owner});
    await this.koda.mint(owner2, editionNumber1, {from: _owner});
    await this.koda.mint(owner3, editionNumber1, {from: _owner});
  });

  describe('constructed properly', async () => {
    it('owner is set', async () => {
      let owner = await this.marketplace.owner();
      owner.should.be.equal(_owner);
    });

    it('KODA address is set', async () => {
      let kodaAddress = await this.marketplace.kodaAddress();
      kodaAddress.should.be.equal(this.koda.address);
    });

    it('min bid is set', async () => {
      let minBidAmount = await this.marketplace.minBidAmount();
      minBidAmount.should.be.eq.BN(etherToWei(0.04));
    });

    it('ko percentage set', async () => {
      let defaultKOPercentage = await this.marketplace.defaultKOPercentage();
      defaultKOPercentage.should.be.eq.BN("30");
    });

    it('artists royalties percentage set', async () => {
      let defaultArtistRoyaltyPercentage = await this.marketplace.defaultArtistRoyaltyPercentage();
      defaultArtistRoyaltyPercentage.should.be.eq.BN("50");
    });

    // FIXME
    it.skip('koCommissionAccount set', async () => {
      let koCommissionAccount = await this.marketplace.koCommissionAccount();
      koCommissionAccount.should.be.equal(_owner);
    });
  });

  describe('Placing a bid', async () => {

    it('fails for invalid token ID', async () => {


    });

    it('fails if contract paused', async () => {

    });

    it('fails if less than minimum bid amount', async () => {

    });

    it('fails if token is disabled from offers', async () => {

    });

    describe.only('when a bid is placed', async () => {

      beforeEach(async () => {
        await this.marketplace.placeBid(token1, {from: bidder1, value: this.minBidAmount});
      });

      it('offer is placed', async () => {
        const {_bidder, _offer, _owner, _enabled, _paused} = await this.marketplace.tokenOffer(token1);
        _bidder.should.be.equal(bidder1);
        _offer.should.be.eq.BN(this.minBidAmount);
        _owner.should.be.equal(owner1);
        _enabled.should.be.equal(true);
        _paused.should.be.equal(false);
      });

    });


  });

  describe('Increasing a bid', async () => {

    beforeEach(async () => {

    });

    it('fails for invalid token ID', async () => {

    });

    it('fails if contract paused', async () => {

    });

    it('fails if less than minimum bid amount', async () => {

    });

    it('fails if token is disabled from offers', async () => {

    });

    it('', async () => {

    });

  });

  describe('Withdrawing a bid', async () => {

    beforeEach(async () => {

    });

    it('fails for invalid token ID', async () => {

    });

    it('fails if contract paused', async () => {

    });

    it('fails if token is disabled from offers', async () => {

    });

    it('fails if caller is not offer owner', async () => {

    });

    it('', async () => {

    });

  });

  describe('Rejecting a bid', async () => {

    beforeEach(async () => {

    });

    it('fails for invalid token ID', async () => {

    });

    it('fails if contract paused', async () => {

    });

    it('fails if caller is not token owner', async () => {

    });

    it('fails if no offer open', async () => {

    });

    it('', async () => {

    });

  });

  describe('Accepting a bid', async () => {

    it('fails for invalid token ID', async () => {

    });

    it('fails if contract paused', async () => {

    });

    it('fails if caller is not token owner', async () => {

    });

    it('fails if no offer open', async () => {

    });

    it('', async () => {

    });

  });

});

