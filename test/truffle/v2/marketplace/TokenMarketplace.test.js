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

contract('TokenMarketplace tests', function (accounts) {

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const ROLE_MINTER = 2;

  const _owner = accounts[0];
  const koCommission = accounts[1];

  const artistAccount1 = accounts[2];
  const artistAccount2 = accounts[3];

  const bidder1 = accounts[4];
  const bidder2 = accounts[5];
  const bidder3 = accounts[6];
  const bidder4 = accounts[7];

  const editionNumber1 = 100000;
  const editionType = 1;
  const editionData1 = web3.utils.asciiToHex("editionData1");
  const editionTokenUri1 = "edition1";
  const edition1Price = etherToWei(0.1);

  const artistCommission = toBN(76);
  const totalAvailable = 5;

  beforeEach(async () => {
    // Create contracts
    this.koda = await KnownOriginDigitalAssetV2.new({from: _owner});
    this.marketplace = await TokenMarketplace.new(this.koda.address, _owner, {from: _owner});

    // Update the commission account to be something different than owner
    await this.marketplace.setKoCommissionAccount(koCommission, {from: _owner});

    // Whitelist the auction contract
    await this.koda.addAddressToAccessControl(this.marketplace.address, ROLE_MINTER, {from: _owner});

    // Grab the min bid amount
    this.minBidAmount = toBN(await this.marketplace.minBidAmount());
  });

  beforeEach(async () => {
    // Create a new edition, unsold with 5 available
    await this.koda.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount1, artistCommission, edition1Price, editionTokenUri1, totalAvailable, {from: _owner});
  });

  describe('constructed properly', async () => {
    it('owner is set', async () => {
      let owner = await this.auction.owner();
      owner.should.be.equal(_owner);
    });

    it('KODA address is set', async () => {
      let kodaAddress = await this.auction.kodaAddress();
      kodaAddress.should.be.equal(this.koda.address);
    });

    it('min bid is set', async () => {
      let minBidAmount = await this.auction.minBidAmount();
      minBidAmount.should.be.eq.BN(etherToWei(0.01));
    });

    it('ko percentage set', async () => {
      let defaultKOPercentage = await this.auction.defaultKOPercentage();
      defaultKOPercentage.should.be.eq.BN("30");
    });

    it('artists royalties percentage set', async () => {
      let defaultArtistRoyaltyPercentage = await this.auction.defaultArtistRoyaltyPercentage();
      defaultArtistRoyaltyPercentage.should.be.eq.BN("50");
    });

    it('koCommissionAccount set', async () => {
      let koCommissionAccount = await this.auction.koCommissionAccount();
      koCommissionAccount.should.be.eq.BN("50");
    });
  });

});

