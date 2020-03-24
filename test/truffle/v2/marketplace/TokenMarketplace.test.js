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

  const artistAccount = accounts[2];
  const optionalArtistAccount = accounts[3];

  const bidder1 = accounts[4];
  const bidder2 = accounts[5];
  const bidder3 = accounts[6];

  const owner1 = accounts[7];
  const owner2 = accounts[8];
  const owner3 = accounts[9];

  const editionNumber1 = 100000;
  const editionNumber2 = 200000;
  const editionType = 1;
  const editionData = web3.utils.asciiToHex("editionData");
  const tokenUri = "edition1";
  const editionPrice = etherToWei(0.1);

  const artistCommission = toBN(85);
  const totalAvailable = 5;

  const artistCommissionSplit = toBN(43);
  const optionalCommissionSplit = toBN(42);

  const _1_token1 = 100001;
  const _1_token2 = 100002;
  const _1_token3 = 100003;

  const _2_token1 = 200001;
  const _2_token2 = 200002;
  const _2_token3 = 200003;

  beforeEach(async () => {
    // Create contracts
    this.koda = await KnownOriginDigitalAssetV2.new({from: _owner});
    this.marketplace = await TokenMarketplace.new(this.koda.address, _owner, {from: _owner});

    // Update the commission account to be something different than owner
    await this.marketplace.setKoCommissionAccount(koCommission, {from: _owner});

    // Grab the min bid amount
    this.minBidAmount = toBN(await this.marketplace.minBidAmount());
  });

  beforeEach(async () => {
    // Create a new edition
    await this.koda.createActiveEdition(editionNumber1, editionData, editionType, 0, 0, artistAccount, artistCommission, editionPrice, tokenUri, totalAvailable, {from: _owner});

    // Create a new edition with split commission
    await this.koda.createActiveEdition(editionNumber2, editionData, editionType, 0, 0, artistAccount, artistCommissionSplit, editionPrice, tokenUri, totalAvailable, {from: _owner});
    await this.koda.updateOptionalCommission(editionNumber2, optionalCommissionSplit, optionalArtistAccount, {from: _owner});

    // Give each owner a token
    await this.koda.mint(owner1, editionNumber1, {from: _owner});
    await this.koda.mint(owner2, editionNumber1, {from: _owner});
    await this.koda.mint(owner3, editionNumber1, {from: _owner});

    // Give each owner a token
    await this.koda.mint(owner1, editionNumber2, {from: _owner});
    await this.koda.mint(owner2, editionNumber2, {from: _owner});
    await this.koda.mint(owner3, editionNumber2, {from: _owner});

    // Set all owners to approve all on the marketplace
    await this.koda.setApprovalForAll(this.marketplace.address, true, {from: owner1});
    await this.koda.setApprovalForAll(this.marketplace.address, true, {from: owner2});
    await this.koda.setApprovalForAll(this.marketplace.address, true, {from: owner3});
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

    it('koCommissionAccount set', async () => {
      let koCommissionAccount = await this.marketplace.koCommissionAccount();
      koCommissionAccount.should.be.equal(koCommission);
    });
  });

  describe('Placing a bid', async () => {

    it('fails for invalid token ID', async () => {
      await assertRevert(
        this.marketplace.placeBid(9999, {from: bidder1, value: this.minBidAmount}),
        'Token does not exist'
      );
    });

    it('fails if contract paused', async () => {
      await this.marketplace.pause({from: _owner});
      await assertRevert(
        this.marketplace.placeBid(9999, {from: bidder1, value: this.minBidAmount})
      );
    });

    it('fails if less than minimum bid amount', async () => {
      await assertRevert(
        this.marketplace.placeBid(_1_token1, {from: bidder1, value: etherToWei(0.01)}),
        "Offer not enough"
      );
    });

    it('fails if token is disabled from offers', async () => {
      await this.marketplace.disableAuction(_1_token1, {from: _owner});
      await assertRevert(
        this.marketplace.placeBid(_1_token1, {from: bidder1, value: this.minBidAmount}),
        "Token not enabled for offers"
      );
    });

    describe('when a bid is placed', async () => {

      beforeEach(async () => {
        await this.marketplace.placeBid(_1_token1, {from: bidder1, value: this.minBidAmount});
      });

      it('offer is placed', async () => {
        const {_bidder, _offer, _owner, _enabled, _paused} = await this.marketplace.tokenOffer(_1_token1);
        _bidder.should.be.equal(bidder1);
        _offer.should.be.eq.BN(this.minBidAmount);
        _owner.should.be.equal(owner1);
        _enabled.should.be.equal(true);
        _paused.should.be.equal(false);
      });

      it('the contract balance is updated', async () => {
        let auctionBalance = await getBalance(this.marketplace.address);
        auctionBalance.should.be.eq.BN(this.minBidAmount);
      });

      describe('and then being out bid', async () => {

        beforeEach(async () => {
          this.newBidAmount = this.minBidAmount.mul(toBN(2));
          this.bidder1Balance = await getBalance(bidder1);
          await this.marketplace.placeBid(_1_token1, {from: bidder2, value: this.newBidAmount});
        });

        it('the original bidder is refunded', async () => {
          const postBidBidder1Balance = await getBalance(bidder1);
          postBidBidder1Balance.should.be.eq.BN(
            this.bidder1Balance.add(this.minBidAmount)
          );
        });

        it('the contract balance is updated', async () => {
          let auctionBalance = await getBalance(this.marketplace.address);
          auctionBalance.should.be.eq.BN(this.newBidAmount);
        });

        it('the new offer is placed', async () => {
          const {_bidder, _offer, _owner, _enabled, _paused} = await this.marketplace.tokenOffer(_1_token1);
          _bidder.should.be.equal(bidder2);
          _offer.should.be.eq.BN(this.newBidAmount);
          _owner.should.be.equal(owner1);
          _enabled.should.be.equal(true);
          _paused.should.be.equal(false);
        });

        describe('then the owner accepts the bid', async () => {

          beforeEach(async () => {
            this.bidder2Balance = await getBalance(bidder2);
            this.owner1Balance = await getBalance(owner1);
            this.marketplaceBalance = await getBalance(this.marketplace.address);
            this.koCommissionBalance = await getBalance(koCommission);
            this.artistAccountBalance = await getBalance(artistAccount);

            let tx = await this.marketplace.acceptBid(_1_token1, {from: owner1});
            this.txGasCosts = await getGasCosts(tx);

            this.bidder2PostBalance = await getBalance(bidder2);
            this.owner1PostBalance = await getBalance(owner1);
            this.marketplacePostBalance = await getBalance(this.marketplace.address);
            this.koCommissionPostBalance = await getBalance(koCommission);
            this.artistAccountPostBalance = await getBalance(artistAccount);

            console.log("bidder2PostBalance", this.bidder2PostBalance.toString());
            console.log("owner1PostBalance", this.owner1PostBalance.toString());
            console.log("marketplacePostBalance", this.marketplacePostBalance.toString());
            console.log("koCommissionPostBalance", this.koCommissionPostBalance.toString());
            console.log("artistAccountPostBalance", this.artistAccountPostBalance.toString());
          });

          it('bidder2 now owns the token', async () => {
            const owner = await this.koda.ownerOf(_1_token1);
            owner.should.be.equal(bidder2);
          });

          it('owner balance goes up and does not own the token', async () => {
            // Does not own token
            const owner = await this.koda.ownerOf(_1_token1);
            owner.should.not.be.equal(owner1);

            // Should get 92% of the funds
            this.owner1PostBalance.should.be.eq.BN(
              this.owner1Balance.add(
                this.newBidAmount
                  .div(toBN(100)).mul(toBN(92)) // 95%
                  .sub(this.txGasCosts) // minus gas costs
              )
            );
          });

          it('ko commission account balance goes up', async () => {
            // Should get 3% of the funds
            this.koCommissionPostBalance.should.be.eq.BN(
              this.koCommissionBalance.add(
                this.newBidAmount
                  .div(toBN(100)).mul(toBN(3)) // 3%
              )
            );
          });

          it('artist commission account balance goes up', async () => {
            // Should get 5% of the funds
            this.artistAccountPostBalance.should.be.eq.BN(
              this.artistAccountBalance.add(
                this.newBidAmount
                  .div(toBN(100)).mul(toBN(5)) // 5%
              )
            );
          });

          it('marketplace balance is cleared', async () => {
            this.marketplacePostBalance.should.be.eq.BN("0");
          });

        });

      });

    });

  });

  describe('Placing a bid on an edition with multiple collaborators', async () => {

    beforeEach(async () => {
      this.minBidAmount = etherToWei(1);
      await this.marketplace.placeBid(_2_token1, {from: bidder1, value: this.minBidAmount});
    });

    it('offer is placed', async () => {
      const {_bidder, _offer, _owner, _enabled, _paused} = await this.marketplace.tokenOffer(_2_token1);
      _bidder.should.be.equal(bidder1);
      _offer.should.be.eq.BN(this.minBidAmount);
      _owner.should.be.equal(owner1);
      _enabled.should.be.equal(true);
      _paused.should.be.equal(false);
    });

    describe('when the owner accepts the bid', async () => {

      beforeEach(async () => {
        this.bidder1Balance = await getBalance(bidder1);
        this.owner1Balance = await getBalance(owner1);
        this.koCommissionBalance = await getBalance(koCommission);
        this.artistAccountBalance = await getBalance(artistAccount);
        this.optionalArtistAccountBalance = await getBalance(optionalArtistAccount);

        let tx = await this.marketplace.acceptBid(_2_token1, {from: owner1});
        this.txGasCosts = await getGasCosts(tx);

        this.bidder1PostBalance = await getBalance(bidder1);
        this.owner1PostBalance = await getBalance(owner1);
        this.marketplacePostBalance = await getBalance(this.marketplace.address);
        this.koCommissionPostBalance = await getBalance(koCommission);
        this.artistAccountPostBalance = await getBalance(artistAccount);
        this.optionalArtistAccountPostBalance = await getBalance(optionalArtistAccount);

        console.log("bidder1PostBalance", this.bidder1PostBalance.toString());
        console.log("owner1PostBalance", this.owner1PostBalance.toString());
        console.log("marketplacePostBalance", this.marketplacePostBalance.toString());
        console.log("koCommissionPostBalance", this.koCommissionPostBalance.toString());
        console.log("artistAccountPostBalance", this.artistAccountPostBalance.toString());
        console.log("optionalArtistAccountPostBalance", this.optionalArtistAccountPostBalance.toString());
      });

      it('bidder2 now owns the token', async () => {
        const owner = await this.koda.ownerOf(_2_token1);
        owner.should.be.equal(bidder1);
      });

      it('owner balance goes up and does not own the token', async () => {
        // Does not own token
        const owner = await this.koda.ownerOf(_2_token1);
        owner.should.not.be.equal(owner1);

        // Should get 92% of the funds
        this.owner1PostBalance.should.be.eq.BN(
          this.owner1Balance.add(
            this.minBidAmount
              .div(toBN(100)).mul(toBN(92)) // 92%
              .sub(this.txGasCosts) // minus gas costs
          )
        );
      });

      it('ko commission account balance goes up', async () => {
        // Should get 3% of the funds
        this.koCommissionPostBalance.should.be.eq.BN(
          this.koCommissionBalance.add(
            this.minBidAmount
              .div(toBN(100)).mul(toBN(3)) // 3%
          )
        );
      });

      it('artist commission account balance goes up', async () => {
        this.artistAccountPostBalance.sub(this.artistAccountBalance)
          .should.be.eq.BN("25294117647058823"); // gained slightly more due to the 43/42 split
      });

      it('optional artist commission account balance goes up', async () => {
        this.optionalArtistAccountPostBalance.sub(this.optionalArtistAccountBalance)
          .should.be.eq.BN("24705882352941177");  // gained slightly less due to the 43/42 split
      });

      it('marketplace balance is cleared', async () => {
        this.marketplacePostBalance.should.be.eq.BN("0");
      });

    });

  });

  describe.skip('Increasing a bid', async () => {

    beforeEach(async () => {
      this.marketplace.placeBid(_1_token1, {from: bidder1, value: this.minBidAmount})
    });

    it('fails for invalid token ID', async () => {
      await assertRevert(
        this.marketplace.increaseBid(9999, {from: bidder1, value: this.minBidAmount}),
        'Token does not exist'
      );
    });

    it('fails if contract paused', async () => {
      await this.marketplace.pause({from: _owner});
      await assertRevert(
        this.marketplace.increaseBid(9999, {from: bidder1, value: this.minBidAmount})
      );
    });

    it('fails if less than minimum bid amount', async () => {
      await assertRevert(
        this.marketplace.increaseBid(_1_token1, {from: bidder1, value: etherToWei(0.01)}),
        "Offer not enough"
      );
    });

    it('fails if token is disabled from offers', async () => {
      await this.marketplace.disableAuction(_1_token1, {from: _owner});
      await assertRevert(
        this.marketplace.increaseBid(_1_token1, {from: bidder1, value: this.minBidAmount}),
        "Token not enabled for offers"
      );
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

