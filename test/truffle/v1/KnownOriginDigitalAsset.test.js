const assertRevert = require('../../helpers/assertRevert');
const etherToWei = require('../../helpers/etherToWei');

const {increaseTo, latest, duration, advanceBlock} = require('../../helpers/time');
const bnChai = require('bn-chai');
const toBN = require('../../helpers/toBN');
const getBalance = require('../../helpers/getBalance');

const _ = require('lodash');

const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

require('chai')
  .use(require('chai-as-promised'))
  .use(bnChai(web3.utils.BN))
  .should();

contract('KnownOriginDigitalAssetV1 custom code', function (accounts) {
  const _developmentAccount = accounts[0];
  const _curatorAccount = accounts[1];
  const _artist = accounts[2];

  const _buyer = accounts[3];
  const _anotherBuyer = accounts[4];

  //Purchase states
  const Unsold = 0;
  const EtherPurchase = 1;
  const FiatPurchase = 2;

  const firstTokenId = 0;

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const _baseUri = 'https://ipfs.infura.io/ipfs/';
  const _tokenURI = web3.utils.asciiToHex('abc123');
  const _editionDigital = web3.utils.asciiToHex('ABC0000000000DIG');
  const _editionPhysical = web3.utils.asciiToHex('ABC0000000000PHY');

  const _priceInWei = etherToWei(0.5);
  let _purchaseFromTime;

  before(async () => {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async () => {
    // developers will mine the contract and pass the curator account into it...
    this.token = await KnownOriginDigitalAsset.new(_curatorAccount, {from: _developmentAccount});
    _purchaseFromTime = await latest(); // opens immediately

    await increaseTo(_purchaseFromTime + duration.seconds(1)); // force time to move 1 seconds so normal tests pass

    // set base commission rates
    await this.token.updateCommission('DIG', 12, 12, {from: _developmentAccount});
    await this.token.updateCommission('PHY', 24, 15, {from: _developmentAccount});
  });

  describe('custom functions', () => {

    describe('mint()', () => {
      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
      });

      describe('balanceOf', () => {
        describe('when the given address owns some tokens', () => {
          it('returns the amount of tokens owned by the given address', async () => {
            const balance = await this.token.balanceOf(_curatorAccount);
            balance.should.be.eq.BN(1);
          });
        });
        describe('when the given address does not own any tokens', () => {
          it('returns 0', async () => {
            const balance = await this.token.balanceOf(_buyer);
            balance.should.be.eq.BN(0);
          });
        });
      });

      it('assetInfo() & editionInfo() are fully populated', async () => {
        // Asset info
        const assetInfo = await this.token.assetInfo(firstTokenId);

        let tokenId = assetInfo[0];
        tokenId.should.be.eq.BN(firstTokenId);

        let owner = assetInfo[1];
        owner.should.be.equal(_curatorAccount);

        let purchaseState = assetInfo[2];
        purchaseState.should.be.eq.BN(Unsold);

        let priceInWei = assetInfo[3];
        priceInWei.should.be.eq.BN(_priceInWei);

        let auctionStartDate = assetInfo[4];
        auctionStartDate.should.be.eq.BN(_purchaseFromTime);

        // Edition info
        const editionInfo = await this.token.editionInfo(firstTokenId);

        let tokenId2 = editionInfo[0];
        tokenId2.should.be.eq.BN(firstTokenId);

        let edition = editionInfo[1];
        web3.utils.toAscii(edition).should.be.equal('ABC0000000000DIG');

        let editionNumber = editionInfo[2];
        editionNumber.should.be.eq.BN(1);

        let tokenUri = editionInfo[3];
        tokenUri.toString().should.be.equal(_baseUri + _tokenURI);
      });

      it('editionOf()', async () => {
        const edition = await this.token.editionOf(firstTokenId);
        web3.utils.toAscii(edition).should.be.equal('ABC0000000000DIG');
      });

      it('tokenAuctionOpenDate()', async () => {
        const purchaseFromTime = await this.token.purchaseFromTime(firstTokenId);
        purchaseFromTime.should.be.eq.BN(_purchaseFromTime);
      });

      it('priceInWei()', async () => {
        const priceInWei = await this.token.priceInWei(firstTokenId);
        priceInWei.should.be.eq.BN(_priceInWei);
      });
    });

    describe('purchaseWithEther()', () => {
      const NUMBER_OF_EDITIONS = 10;
      const tokenToPurchase = new web3.utils.BN(3);

      beforeEach(async () => {
        const totalInEdition = _.range(0, NUMBER_OF_EDITIONS);
        for (let tokenId of totalInEdition) {
          await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {
            from: _curatorAccount
          });
        }

        //Ensure all Unsold
        const range = _.range(0, NUMBER_OF_EDITIONS);
        for (let tokenId of range) {
          let isPurchased = await this.token.isPurchased(tokenId);
          isPurchased.should.be.eq.BN(Unsold);

          let ownerOf = await this.token.ownerOf(tokenId);
          ownerOf.should.be.equal(_curatorAccount);
        }

        //Ensure all Ids as expected and owned by _curatorAccount
        let ownerTokens = await this.token.tokensOf(_curatorAccount);
        ownerTokens = ownerTokens.map((tokenId) => tokenId.toNumber());
        ownerTokens.should.be.deep.equal(range);

        let editionInfo = await this.token.editionInfo(firstTokenId);
        editionInfo[2].toNumber().should.be.equal(NUMBER_OF_EDITIONS);
      });

      describe('price in wei', () => {
        it('can only purchase if price equal to token value', async () => {

          let {logs} = await this.token.purchaseWithEther(tokenToPurchase, {
            value: _priceInWei,
            from: _buyer
          });

          logs.length.should.be.equal(4);

          // Approve new _buyer
          logs[0].event.should.be.equal('Approval');
          logs[0].args._owner.should.be.equal(_curatorAccount);
          logs[0].args._approved.should.be.equal(_buyer);
          logs[0].args._tokenId.should.be.eq.BN(tokenToPurchase);

          // Approval cleared on transfer
          logs[1].event.should.be.equal('Approval');
          logs[1].args._owner.should.be.equal(_curatorAccount);
          logs[1].args._approved.should.be.equal(ZERO_ADDRESS);
          logs[1].args._tokenId.should.be.eq.BN(tokenToPurchase);

          // Transferred
          logs[2].event.should.be.equal('Transfer');
          logs[2].args._from.should.be.equal(_curatorAccount);
          logs[2].args._to.should.be.equal(_buyer);
          logs[2].args._tokenId.should.be.eq.BN(tokenToPurchase);

          // Internal event fired
          logs[3].event.should.be.equal('PurchasedWithEther');
          logs[3].args._buyer.should.be.equal(_buyer);
          logs[3].args._tokenId.should.be.eq.BN(tokenToPurchase);

          // check is purchased with ether
          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(EtherPurchase);

          // check token is now the owner
          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_buyer);

          // check approval of sold token reset to zero
          let getApproved = await this.token.getApproved(tokenToPurchase);
          getApproved.should.be.equal(ZERO_ADDRESS);

          //Ensure _curatorAccount still owns all bu the purchased token
          let ownerTokens = await this.token.tokensOf(_curatorAccount);
          ownerTokens = ownerTokens.map((tokenId) => tokenId.toNumber());
          ownerTokens.sort().should.be.deep.equal([0, 1, 2, 4, 5, 6, 7, 8, 9]);
        });

        it('succeeds purchase is price greater than amount asked for', async () => {
          await this.token.purchaseWithEther(tokenToPurchase, {value: _priceInWei.add(toBN(1)), from: _buyer});

          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(EtherPurchase);

          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_buyer);
        });

        it('fails purchase is price less than amount asked for', async () => {
          await assertRevert(this.token.purchaseWithEther(tokenToPurchase, {
            value: _priceInWei.sub(toBN(1)),
            from: _buyer
          }));

          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(Unsold);

          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_curatorAccount);
        });
      });

      describe('can only purchase if unsold', () => {

        beforeEach(async () => {
          await this.token.purchaseWithEther(tokenToPurchase, {
            value: _priceInWei,
            from: _buyer
          });

          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_buyer);

          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(EtherPurchase);
        });

        it('reverts if already sold', async () => {
          await assertRevert(this.token.purchaseWithEther(tokenToPurchase, {value: _priceInWei, from: _anotherBuyer}));
        });
      });

      describe('purchasing from different accounts', () => {
        it('can purchase if currently owned by _curatorAccount', async () => {
          await this.token.purchaseWithEther(tokenToPurchase, {
            value: _priceInWei,
            from: _curatorAccount
          });

          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_curatorAccount);

          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(EtherPurchase);
        });

        it('can purchase if currently owned by contractDeveloper', async () => {
          await this.token.purchaseWithEther(tokenToPurchase, {
            value: _priceInWei,
            from: _developmentAccount
          });

          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_developmentAccount);

          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(EtherPurchase);
        });
      });

      describe('should not transfer ownership if artwork has value and purchaser sends zero', () => {
        it('should fail with invalid amount', async () => {
          await assertRevert(this.token.purchaseWithEther(tokenToPurchase, {
            value: _priceInWei.sub(toBN(1)),
            from: _buyer
          }));

          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_curatorAccount);

          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(Unsold);
        });
      });

      describe('should transfer ownership if artwork has value is the same', () => {
        it('should transfer ownership', async () => {
          await this.token.purchaseWithEther(tokenToPurchase, {
            value: _priceInWei,
            from: _buyer
          });

          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_buyer);

          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(EtherPurchase);
        });
      });

      describe('should transfer ownership if artwork has value is greater', () => {
        it('should transfer ownership', async () => {
          await this.token.purchaseWithEther(tokenToPurchase, {
            value: _priceInWei.add(toBN(1)),
            from: _buyer
          });

          let ownerOf = await this.token.ownerOf(tokenToPurchase);
          ownerOf.should.be.equal(_buyer);

          let isPurchased = await this.token.isPurchased(tokenToPurchase);
          isPurchased.should.be.eq.BN(EtherPurchase);
        });
      });
    });

    describe('can only purchase if auction date open', () => {

      beforeEach(async () => {
        _purchaseFromTime += duration.seconds(30);
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
      });

      it('should not be able to buy with fiat yet', async () => {
        await assertRevert(this.token.purchaseWithFiat(firstTokenId, {from: _buyer}));
      });

      it('should not be able to buy with ether yet', async () => {
        await assertRevert(this.token.purchaseWithEther(firstTokenId, {value: _priceInWei, from: _buyer}));
      });

      describe('purchaseWithFiat()', async () => {

        beforeEach(async () => {
          await increaseTo((await latest()) + duration.minutes(1));
        });

        it('should be able to buy once open', async () => {
          await this.token.purchaseWithFiat(firstTokenId, {
            from: _curatorAccount
          });

          let ownerOf = await this.token.ownerOf(firstTokenId);
          ownerOf.should.be.equal(_curatorAccount);

          let isPurchased = await this.token.isPurchased(firstTokenId);
          isPurchased.should.be.eq.BN(FiatPurchase);
        });
      });

      describe('purchaseWithEther()', async () => {

        beforeEach(async () => {
          await increaseTo((await latest()) + duration.minutes(1));
        });

        it('should be able to buy once open', async () => {
          await this.token.purchaseWithEther(firstTokenId, {
            value: _priceInWei,
            from: _buyer
          });

          let ownerOf = await this.token.ownerOf(firstTokenId);
          ownerOf.should.be.equal(_buyer);

          let isPurchased = await this.token.isPurchased(firstTokenId);
          isPurchased.should.be.eq.BN(EtherPurchase);
        });

      });
    });

    describe('purchaseWithFiat()', () => {
      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });

        let isPurchased = await this.token.isPurchased(firstTokenId);
        isPurchased.should.be.eq.BN(Unsold);

        let ownerOf = await this.token.ownerOf(firstTokenId);
        ownerOf.should.be.equal(_curatorAccount);
      });

      describe('can actually make purchaseWithFiat() if _curatorAccount', () => {
        it('updates owner and sets as sold', async () => {
          let {logs} = await this.token.purchaseWithFiat(firstTokenId, {
            from: _developmentAccount
          });

          let ownerOf = await this.token.ownerOf(firstTokenId);
          ownerOf.should.be.equal(_curatorAccount);

          let isPurchased = await this.token.isPurchased(firstTokenId);
          isPurchased.should.be.eq.BN(FiatPurchase);

          //emit correct logs
          logs.length.should.be.equal(1);
          logs[0].event.should.be.equal('PurchasedWithFiat');
          logs[0].args._tokenId.should.be.eq.BN(firstTokenId);
        });
      });

      describe('only if not already sold via purchaseWithEther()', () => {
        beforeEach(async () => {
          await this.token.purchaseWithEther(firstTokenId, {
            value: _priceInWei,
            from: _buyer
          });
          let isPurchased = await this.token.isPurchased(firstTokenId);
          isPurchased.should.be.eq.BN(EtherPurchase);
        });

        it('reverts if already sold', async () => {
          await assertRevert(this.token.purchaseWithFiat(firstTokenId, {
            from: _anotherBuyer
          }));
        });
      });

      describe('only if not already sold via purchaseWithFiat()', () => {
        beforeEach(async () => {
          await this.token.purchaseWithFiat(firstTokenId, {
            from: _developmentAccount
          });
          let isPurchased = await this.token.isPurchased(firstTokenId);
          isPurchased.should.be.eq.BN(FiatPurchase);
        });

        it('reverts if already sold', async () => {
          await assertRevert(this.token.purchaseWithFiat(firstTokenId, {
            from: _curatorAccount
          }));
        });
      });

      it('reverts if called by _buyer', async () => {
        await assertRevert(this.token.purchaseWithFiat(firstTokenId, {from: _anotherBuyer}));
      });

      it('reverts if called by another _buyer', async () => {
        await assertRevert(this.token.purchaseWithFiat(firstTokenId, {from: _anotherBuyer}));
      });
    });

    describe('reverseFiatPurchase()', () => {
      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
      });

      it('cannot reverse token which is unsold', async () => {
        await assertRevert(this.token.reverseFiatPurchase(firstTokenId));
      });

      it('cannot reverse token which is purchased with ether', async () => {
        await this.token.purchaseWithEther(firstTokenId, {
          value: _priceInWei,
          from: _buyer
        });

        let isPurchased = await this.token.isPurchased(firstTokenId);
        isPurchased.should.be.eq.BN(EtherPurchase);

        await assertRevert(this.token.reverseFiatPurchase(firstTokenId));
      });

      describe('once purchased with fiat', async () => {

        beforeEach(async () => {
          await this.token.purchaseWithFiat(firstTokenId, {
            from: _developmentAccount
          });
          let isPurchased = await this.token.isPurchased(firstTokenId);
          isPurchased.should.be.eq.BN(FiatPurchase);
        });

        describe('can be called by _curatorAccount', async () => {
          it('and is successful', async () => {
            let {logs} = await this.token.reverseFiatPurchase(firstTokenId, {from: _curatorAccount});

            let isPurchased = await this.token.isPurchased(firstTokenId);
            isPurchased.should.be.eq.BN(Unsold);

            logs.length.should.be.equal(1);
            logs[0].event.should.be.equal('PurchasedWithFiatReversed');
            logs[0].args._tokenId.should.be.eq.BN(firstTokenId);
          });
        });

        describe('can be called by developer', async () => {
          it('and is successful', async () => {
            let {logs} = await this.token.reverseFiatPurchase(firstTokenId, {from: _developmentAccount});

            let isPurchased = await this.token.isPurchased(firstTokenId);
            isPurchased.should.be.eq.BN(Unsold);

            logs.length.should.be.equal(1);
            logs[0].event.should.be.equal('PurchasedWithFiatReversed');
            logs[0].args._tokenId.should.be.eq.BN(firstTokenId);
          });
        });

        it('cannot be called by _buyer', async () => {
          await assertRevert(this.token.reverseFiatPurchase(firstTokenId, {from: _buyer}));
        });
      });
    });

    describe('setTokenURI()', () => {

      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
      });

      it('can be called by _curatorAccount', async () => {
        await this.token.setTokenURI(firstTokenId, 'hash/1', {
          from: _curatorAccount
        });
        let editionInfo = await this.token.editionInfo(firstTokenId);
        editionInfo[3].should.be.equal(_baseUri + 'hash/1');
      });

      it('can be called by developer', async () => {
        await this.token.setTokenURI(firstTokenId, 'hash/2', {
          from: _developmentAccount
        });
        let editionInfo = await this.token.editionInfo(firstTokenId);
        editionInfo[3].should.be.equal(_baseUri + 'hash/2');
      });

      it('will fail if called by _buyer', async () => {
        await assertRevert(this.token.setTokenURI(firstTokenId, 'hash/3', {
          from: _buyer
        }));

        let editionInfo = await this.token.editionInfo(firstTokenId);
        editionInfo[3].should.be.equal(_baseUri + _tokenURI);
      });
    });

    describe('setPriceInWei()', () => {
      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
      });

      it('can be called by _curatorAccount', async () => {
        await this.token.setPriceInWei(firstTokenId, _priceInWei.add(toBN(1)), {
          from: _curatorAccount
        });
        let assetInfo = await this.token.assetInfo(firstTokenId);
        assetInfo[3].should.be.eq.BN(_priceInWei.add(toBN(1)));
      });

      it('can be called by developer', async () => {
        await this.token.setPriceInWei(firstTokenId, _priceInWei.sub(toBN(1)), {
          from: _developmentAccount
        });
        let assetInfo = await this.token.assetInfo(firstTokenId);
        assetInfo[3].should.be.eq.BN(_priceInWei.sub(toBN(1)));
      });

      it('will fail if called by _buyer', async () => {
        await assertRevert(this.token.setPriceInWei(firstTokenId, toBN(_priceInWei).sub(toBN(1)), {
          from: _buyer
        }));
      });

      describe('once purchased', async () => {
        beforeEach(async () => {
          await this.token.purchaseWithFiat(firstTokenId, {
            from: _developmentAccount
          });
          let isPurchased = await this.token.isPurchased(firstTokenId);
          isPurchased.should.be.eq.BN(FiatPurchase);
        });

        it('cannot be called', async () => {
          await assertRevert(this.token.setPriceInWei(firstTokenId, _priceInWei.sub(toBN(1)), {
            from: _curatorAccount
          }));
        });
      });
    });

  });

  describe('commission structure', () => {

    it('should get default commission for contract', async () => {
      let commission = await this.token.getCommissionForType('DIG');
      commission[0].should.be.eq.BN(12);
      commission[1].should.be.eq.BN(12);

      commission = await this.token.getCommissionForType('PHY');
      commission[0].should.be.eq.BN(24);
      commission[1].should.be.eq.BN(15);
    });

    it('should get type from edition', async () => {
      let type = await this.token.getTypeFromEdition(web3.utils.asciiToHex('ABC0000000000DIG'));
      type.should.be.equal('DIG');

      type = await this.token.getTypeFromEdition(web3.utils.asciiToHex('ABC0000000000PHY'));
      type.should.be.equal('PHY');

      type = await this.token.getTypeFromEdition(web3.utils.asciiToHex('ABC0000000000ABC'));
      type.should.be.equal('ABC');
    });

    it('convert DIG to bytes', async () => {
      console.log(web3.utils.fromAscii('DIG')); // 0x444947
      console.log(web3.utils.fromAscii('PHY')); // 0x504859
    });

    describe('updating commission', () => {

      it('should be able to update as _curatorAccount', async () => {
        let commission = await this.token.getCommissionForType('DIG');
        commission[0].should.be.eq.BN(12);
        commission[1].should.be.eq.BN(12);

        await this.token.updateCommission('DIG', 5, 5, {from: _curatorAccount});

        commission = await this.token.getCommissionForType('DIG');
        commission[0].should.be.eq.BN(5);
        commission[1].should.be.eq.BN(5);
      });

      it('should be able to update as developer', async () => {
        let commission = await this.token.getCommissionForType('DIG');
        commission[0].should.be.eq.BN(12);
        commission[1].should.be.eq.BN(12);

        await this.token.updateCommission('DIG', 1, 2, {from: _developmentAccount});

        commission = await this.token.getCommissionForType('DIG');
        commission[0].should.be.eq.BN(1);
        commission[1].should.be.eq.BN(2);
      });

      it('should fail when _buyer', async () => {
        await assertRevert(this.token.updateCommission('ABC', 50, 0, {from: _buyer}));
      });

      it('should fail when _curatorAccount commission is zero', async () => {
        await assertRevert(this.token.updateCommission('ABC', 0, 50, {from: _curatorAccount}));
      });

      it('should fail when developer commission is zero', async () => {
        await assertRevert(this.token.updateCommission('ABC', 50, 0, {from: _curatorAccount}));
      });

      it('should fail when both commissions are greater than 99', async () => {
        await assertRevert(this.token.updateCommission('ABC', 98, 2, {from: _curatorAccount}));
      });

      it('should be able to add a new commission', async () => {
        let commission = await this.token.getCommissionForType(web3.utils.asciiToHex('ABC'));
        commission[0].should.be.eq.BN(0);
        commission[1].should.be.eq.BN(0);

        await this.token.updateCommission(web3.utils.asciiToHex('ABC'), 30, 20, {from: _developmentAccount});

        commission = await this.token.getCommissionForType(web3.utils.asciiToHex('ABC'));
        commission[0].should.be.eq.BN(30);
        commission[1].should.be.eq.BN(20);
      });

    });

    describe('allocating commissions for digital purchases', () => {

      const tokenToPurchase = 0;

      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
        this.curatorBalance = await getBalance(_curatorAccount);
        this.contractDeveloperBalance = await getBalance(_developmentAccount);

        await this.token.purchaseWithEther(tokenToPurchase, {
          value: _priceInWei,
          from: _buyer
        });

        let ownerOf = await this.token.ownerOf(tokenToPurchase);
        ownerOf.should.be.equal(_buyer);

        let isPurchased = await this.token.isPurchased(tokenToPurchase);
        isPurchased.should.be.eq.BN(EtherPurchase);
      });

      it('curator account receives correct value', async () => {
        let updatedCuratorBalance = await getBalance(_curatorAccount);

        // curator is set as the artist account (as artist may not have account)
        // therefore curator gets the artist amount (to forward on)
        updatedCuratorBalance.should.be.eq.BN(
          this.curatorBalance
            .add(_priceInWei.div(toBN(100)).mul(toBN(12)))
            .add(_priceInWei.div(toBN(100)).mul(toBN(76))) // 12% + 76%
        );
      });

      it('developer account receives correct value', async () => {
        let updatedContractDeveloperBalance = await getBalance(_developmentAccount);
        updatedContractDeveloperBalance.should.be.eq.BN(
          this.contractDeveloperBalance
            .add(
              _priceInWei
                .div(toBN(100))
                .mul(toBN(12))// 12%
            )
        );
      });
    });

    describe('allocating commissions for digital purchases with artist address', () => {

      const tokenToPurchase = 0;

      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _artist, {
          from: _curatorAccount
        });
        this.curatorBalance = await getBalance(_curatorAccount);
        this.contractDeveloperBalance = await getBalance(_developmentAccount);
        this.artistBalance = await getBalance(_artist);

        await this.token.purchaseWithEther(tokenToPurchase, {
          value: _priceInWei,
          from: _buyer
        });

        let ownerOf = await this.token.ownerOf(tokenToPurchase);
        ownerOf.should.be.equal(_buyer);

        let isPurchased = await this.token.isPurchased(tokenToPurchase);
        isPurchased.should.be.eq.BN(EtherPurchase);
      });

      it('curator account receives correct value', async () => {
        let updatedCuratorBalance = await getBalance(_curatorAccount);

        updatedCuratorBalance.should.be.eq.BN(
          this.curatorBalance
            .add(_priceInWei.div(toBN(100)).mul(toBN(12)))
        );
      });

      it('developer account receives correct value', async () => {
        let updatedContractDeveloperBalance = await getBalance(_developmentAccount);
        updatedContractDeveloperBalance.should.be.eq.BN(
          this.contractDeveloperBalance.add(
            _priceInWei
              .div(toBN(100))
              .mul(toBN(12)) // 12%
          )
        );
      });

      it('artist account receives correct value', async () => {
        let updatedArtistBalance = await getBalance(_artist);
        updatedArtistBalance.should.be.eq.BN(
          this.artistBalance.add(
            _priceInWei
              .div(toBN(100))
              .mul(toBN(76))// 76%
          )
        );
      });
    });

    describe('allocating commissions for digital purchases with zero artist address', () => {

      it('should revert as not allowed', async () => {
        await assertRevert(this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, ZERO_ADDRESS, {
          from: _curatorAccount
        }));
      });
    });

    describe('allocating commissions - physical', () => {

      const tokenToPurchase = 0;

      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionPhysical, _priceInWei, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
        this.curatorBalance = await getBalance(_curatorAccount);
        this.contractDeveloperBalance = await getBalance(_developmentAccount);

        await this.token.purchaseWithEther(tokenToPurchase, {
          value: _priceInWei,
          from: _buyer
        });

        let ownerOf = await this.token.ownerOf(tokenToPurchase);
        ownerOf.should.be.equal(_buyer);

        let isPurchased = await this.token.isPurchased(tokenToPurchase);
        isPurchased.should.be.eq.BN(EtherPurchase);
      });

      it('curator account receives correct value', async () => {
        let updatedCuratorBalance = await getBalance(_curatorAccount);
        updatedCuratorBalance.should.be.eq.BN(
          this.curatorBalance
            .add(_priceInWei.div(toBN(100)).mul(toBN(24))) // 24%
            .add(_priceInWei.div(toBN(100)).mul(toBN(61))) // 61%
        );
      });

      it('developer account receives correct value', async () => {
        let updatedContractDeveloperBalance = await getBalance(_developmentAccount);
        updatedContractDeveloperBalance.should.be.eq.BN(
          this.contractDeveloperBalance.add(
            _priceInWei
              .div(toBN(100))
              .mul(toBN(15)) // 15%
          )
        );
      });

    });

    describe('missing commission rates still allow purchase', () => {

      const tokenToPurchase = 0;
      const _editionWithMissingType = web3.utils.asciiToHex('ABC0000000000MIA');

      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionWithMissingType, _priceInWei, _purchaseFromTime, _artist, {
          from: _curatorAccount
        });
        this.curatorBalance = await getBalance(_curatorAccount);
        this.contractDeveloperBalance = await getBalance(_developmentAccount);
        this.artistBalance = await getBalance(_artist);

        await this.token.purchaseWithEther(tokenToPurchase, {
          value: _priceInWei,
          from: _buyer
        });

        let ownerOf = await this.token.ownerOf(tokenToPurchase);
        ownerOf.should.be.equal(_buyer);

        let isPurchased = await this.token.isPurchased(tokenToPurchase);
        isPurchased.should.be.eq.BN(EtherPurchase);
      });

      it('curator account receives correct value', async () => {
        let updatedCuratorBalance = await getBalance(_curatorAccount);
        updatedCuratorBalance.should.be.eq.BN(this.curatorBalance);
      });

      it('developer account receives correct value', async () => {
        let updatedContractDeveloperBalance = await getBalance(_developmentAccount);
        updatedContractDeveloperBalance.should.be.eq.BN(this.contractDeveloperBalance);
      });

      it('commission account receives correct value', async () => {
        let updatedArtistBalance = await getBalance(_artist);
        updatedArtistBalance.should.be.eq.BN(
          this.artistBalance.add(_priceInWei)
        );
      });

    });

    describe('if the artwork is free, no commission is applied', () => {

      const tokenToPurchase = 0;

      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionPhysical, 0, _purchaseFromTime, _artist, {
          from: _curatorAccount
        });
        this.curatorBalance = await getBalance(_curatorAccount);
        this.contractDeveloperBalance = await getBalance(_developmentAccount);
        this.artistBalance = await getBalance(_artist);

        await this.token.purchaseWithEther(tokenToPurchase, {
          from: _buyer
        });

        let ownerOf = await this.token.ownerOf(tokenToPurchase);
        ownerOf.should.be.equal(_buyer);

        let isPurchased = await this.token.isPurchased(tokenToPurchase);
        isPurchased.should.be.eq.BN(EtherPurchase);
      });

      it('curator account receives correct value of zero', async () => {
        let updatedCuratorBalance = await getBalance(_curatorAccount);
        updatedCuratorBalance.should.be.eq.BN(this.curatorBalance);
      });

      it('developer account receives correct value of zero', async () => {
        let updatedContractDeveloperBalance = await getBalance(_developmentAccount);
        updatedContractDeveloperBalance.should.be.eq.BN(this.contractDeveloperBalance);
      });

      it('artist account receives correct value of zero', async () => {
        let updatedArtistBalance = await getBalance(_artist);
        updatedArtistBalance.should.be.eq.BN(this.artistBalance);
      });

    });

    describe('can re-set token base URI', () => {

      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionPhysical, 0, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
      });

      it('should adjust base URI', async () => {
        let uri = await this.token.tokenURI(0);
        uri.should.be.equal(_baseUri + _tokenURI);

        const newBaseUri = 'http://custom.com';
        await this.token.setTokenBaseURI(newBaseUri);

        uri = await this.token.tokenURI(0);
        uri.should.be.equal(newBaseUri + _tokenURI);
      });
    });

    describe('fallback function', () => {

      beforeEach(async () => {
        await this.token.mint(_tokenURI, _editionPhysical, 0, _purchaseFromTime, _curatorAccount, {
          from: _curatorAccount
        });
      });

      it('should revert and not accept value', async () => {
        await assertRevert(this.token.send(1));
      });
    });
  });

  describe('Burning tokens - ', async () => {

    const tokenToBurn = 1;

    beforeEach(async () => {
      // Mint three editions
      await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {from: _curatorAccount});
      await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {from: _curatorAccount});
      await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {from: _curatorAccount});

      const balance = await this.token.balanceOf(_curatorAccount);
      balance.should.be.eq.BN(3);
    });

    describe('can only be called by management', async () => {
      it('reverts when called by non management', async () => {
        await assertRevert(this.token.burn(1, {from: _buyer}));
      });

      it('reverts when called by another non management', async () => {
        await assertRevert(this.token.burn(2, {from: _anotherBuyer}));
      });
    });

    describe('keeps track of the token ID pointer', async () => {
      it('tracks id correctly even after burn', async () => {
        let tokenIdPointer = await this.token.tokenIdPointer();
        tokenIdPointer.should.be.eq.BN(3); // zero indexed

        await this.token.burn(2, {from: _curatorAccount});

        tokenIdPointer = await this.token.tokenIdPointer();
        tokenIdPointer.should.be.eq.BN(3); // zero indexed
      });
    });

    describe('keeps track of the edition total number correctly', async () => {
      it('tracks total in edition correctly', async () => {
        let editionNumber = await this.token.numberOf(_editionDigital);
        editionNumber.should.be.eq.BN(3);

        await this.token.burn(2, {from: _curatorAccount});

        editionNumber = await this.token.numberOf(_editionDigital);
        editionNumber.should.be.eq.BN(2);
      });
    });

    describe('removes reference to internal data', async () => {

      beforeEach(async () => {
        // burn the middle token
        await this.token.burn(tokenToBurn, {from: _curatorAccount});
      });

      it('tokensOf() is correct', async () => {
        let ownerTokens = await this.token.tokensOf(_curatorAccount);
        ownerTokens = ownerTokens.map((tokenId) => tokenId.toNumber());
        ownerTokens.should.be.deep.equal([0, 2]);
      });

      it('balanceOf() is reduced', async () => {
        const balance = await this.token.balanceOf(_curatorAccount);
        balance.should.be.eq.BN(2);
      });

      it('should not exist', async () => {
        const result = await this.token.exists(tokenToBurn);
        result.should.be.false;
      });

      it('should not be purchased', async () => {
        await assertRevert(this.token.isPurchased(tokenToBurn));
      });

      it('should not have editionOf', async () => {
        await assertRevert(this.token.editionOf(tokenToBurn));
      });

      it('should not have purchaseFromTime', async () => {
        await assertRevert(this.token.purchaseFromTime(tokenToBurn));
      });

      it('should not have priceInWei', async () => {
        await assertRevert(this.token.priceInWei(tokenToBurn));
      });

      it('should not have tokenURI', async () => {
        let tokenUri = await this.token.tokenURI(tokenToBurn);
        tokenUri.toString().should.be.equal(_baseUri);
      });

      it('assetInfo() returns missing data', async () => {
        const assetInfo = await this.token.assetInfo(tokenToBurn);

        let tokenId = assetInfo[0];
        tokenId.should.be.eq.BN(tokenToBurn);

        let owner = assetInfo[1];
        owner.should.be.equal(ZERO_ADDRESS);

        let purchaseState = assetInfo[2];
        purchaseState.should.be.eq.BN(Unsold);

        let priceInWei = assetInfo[3];
        priceInWei.should.be.eq.BN(0);

        let auctionStartDate = assetInfo[4];
        auctionStartDate.should.be.eq.BN(0);
      });

      it('editionInfo() returns missing data', async () => {
        let editionInfo = await this.token.editionInfo(tokenToBurn);

        let tokenId = editionInfo[0];
        tokenId.should.be.eq.BN(tokenToBurn);

        let edition = editionInfo[1];
        web3.utils.toAscii(edition).should.be.equal(
          '\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000'
        );

        let editionNumber = editionInfo[2];
        editionNumber.should.be.eq.BN(0);

        let tokenUri = editionInfo[3];
        tokenUri.toString().should.be.equal(_baseUri);
      });
    });

    describe('burning the same token twice', async () => {

      beforeEach(async () => {
        await this.token.burn(tokenToBurn, {from: _curatorAccount});
      });

      it('reverts', async () => {
        await assertRevert(this.token.burn(tokenToBurn, {from: _curatorAccount}));
      });
    });

    describe('tokens already purchased', async () => {
      beforeEach(async () => {
        await this.token.purchaseWithEther(tokenToBurn, {
          value: _priceInWei,
          from: _buyer
        });
      });

      it('reverts when being burnt', async () => {
        await assertRevert(this.token.burn(tokenToBurn, {from: _curatorAccount}));
      });
    });

    describe('minting assets of the same edition', async () => {

      const newlyMintedTokenId = 3;

      beforeEach(async () => {
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.eq.BN(3);

        let editionNumber = await this.token.numberOf(_editionDigital);
        editionNumber.should.be.eq.BN(3);

        // Burn 2 from same edition
        await this.token.burn(tokenToBurn, {from: _curatorAccount});
        await this.token.burn(tokenToBurn + 1, {from: _curatorAccount});

        //new physical asset
        await this.token.mint(_tokenURI, _editionDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {from: _curatorAccount});
      });

      it('tracks total in edition correctly', async () => {
        let editionNumber = await this.token.numberOf(_editionDigital);
        editionNumber.should.be.eq.BN(2);
      });

      it('totalSupply() is correct', async () => {
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.eq.BN(2);
      });

      it('balanceOf() is correct', async () => {
        const balance = await this.token.balanceOf(_curatorAccount);
        balance.should.be.eq.BN(2);
      });

      it('tokensOf() is correct', async () => {
        let ownerTokens = await this.token.tokensOf(_curatorAccount);
        ownerTokens = ownerTokens.map((tokenId) => tokenId.toNumber());
        ownerTokens.should.be.deep.equal([0, newlyMintedTokenId]);
      });

      describe('validates newly minted token data', async () => {

        it('exists()', async () => {
          const result = await this.token.exists(newlyMintedTokenId);
          result.should.be.true;
        });

        it('assetInfo() returns correct data', async () => {
          const assetInfo = await this.token.assetInfo(newlyMintedTokenId);

          let tokenId = assetInfo[0];
          tokenId.should.be.eq.BN(newlyMintedTokenId);

          let owner = assetInfo[1];
          owner.should.be.equal(_curatorAccount);

          let purchaseState = assetInfo[2];
          purchaseState.should.be.eq.BN(Unsold);

          let priceInWei = assetInfo[3];
          priceInWei.should.be.eq.BN(priceInWei);

          let auctionStartDate = assetInfo[4];
          auctionStartDate.should.be.eq.BN(auctionStartDate);
        });

        it('editionInfo() returns correct data', async () => {
          let editionInfo = await this.token.editionInfo(newlyMintedTokenId);

          let tokenId = editionInfo[0];
          tokenId.should.be.eq.BN(newlyMintedTokenId);

          let edition = editionInfo[1];
          web3.utils.toAscii(edition).should.be.equal('ABC0000000000DIG');

          let editionNumber = editionInfo[2];
          editionNumber.should.be.eq.BN(2);

          let tokenUri = editionInfo[3];
          tokenUri.toString().should.be.equal(_baseUri + _tokenURI);
        });

      });

      describe('validates burnt tokens', async () => {

        it('does not exists()', async () => {
          [tokenToBurn, tokenToBurn + 1].forEach(async function (id) {
            let result = await this.token.exists(id);
            result.should.be.false;
          });
        });

        it('editionInfo() is empty for burnt token', async () => {
          [tokenToBurn, tokenToBurn + 1].forEach(async function (id) {
            let editionInfo = await this.token.editionInfo(id);

            let tokenId = editionInfo[0];
            tokenId.should.be.eq.BN(id);

            let edition = editionInfo[1];
            web3.utils.toAscii(edition).should.be.equal(
              '\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000'
            );

            let editionNumber = editionInfo[2];
            editionNumber.should.be.eq.BN(0);

            let tokenUri = editionInfo[3];
            tokenUri.toString().should.be.equal(_baseUri);
          });
        });

        it('assetInfo() is empty', async () => {
          [tokenToBurn, tokenToBurn + 1].forEach(async function (id) {
            const assetInfo = await this.token.assetInfo(id);

            let tokenId = assetInfo[0];
            tokenId.should.be.eq.BN(id);

            let owner = assetInfo[1];
            owner.should.be.equal(ZERO_ADDRESS);

            let purchaseState = assetInfo[2];
            purchaseState.should.be.eq.BN(0);

            let priceInWei = assetInfo[3];
            priceInWei.should.be.eq.BN(0);

            let auctionStartDate = assetInfo[4];
            auctionStartDate.should.be.eq.BN(0);
          });
        });
      });

    });

    describe('minting assets of a NEW edition', async () => {

      const newlyMintedTokenId = 3;
      const anotherNewlyMintedTokenId = 4;

      beforeEach(async () => {
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.eq.BN(3);

        let editionNumber = await this.token.numberOf(_editionDigital);
        editionNumber.should.be.eq.BN(3);

        // Burn 2 so only 1 left
        await this.token.burn(tokenToBurn, {from: _curatorAccount});
        await this.token.burn(tokenToBurn + 1, {from: _curatorAccount});

        //Mint 2 new physical asset
        await this.token.mint(_tokenURI, _editionPhysical, _priceInWei, _purchaseFromTime, _curatorAccount, {from: _curatorAccount});
        await this.token.mint(_tokenURI, _editionPhysical, _priceInWei, _purchaseFromTime, _curatorAccount, {from: _curatorAccount});
      });

      it('totalSupply() is correct', async () => {
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.eq.BN(3);
      });

      it('balanceOf() is correct', async () => {
        const balance = await this.token.balanceOf(_curatorAccount);
        balance.should.be.eq.BN(3);
      });

      it('tokensOf() is correct', async () => {
        let ownerTokens = await this.token.tokensOf(_curatorAccount);
        ownerTokens = ownerTokens.map((tokenId) => tokenId.toNumber());
        ownerTokens.should.be.deep.equal([0, newlyMintedTokenId, anotherNewlyMintedTokenId]);
      });

      describe('existing edition', async () => {
        it('tracks total in edition correctly', async () => {
          let editionNumber = await this.token.numberOf(_editionDigital);
          editionNumber.should.be.eq.BN(1);
        });
      });

      describe('newly minted edition edition', async () => {
        it('tracks total in edition correctly', async () => {
          let editionNumber = await this.token.numberOf(_editionPhysical);
          editionNumber.should.be.eq.BN(2);
        });
      });

      describe('validates newly minted token data', async () => {

        it('exists()', async () => {
          [newlyMintedTokenId, anotherNewlyMintedTokenId].forEach(async function (id) {
            const result = await this.token.exists(id);
            result.should.be.true;
          });
        });

        it('assetInfo() returns correct data', async () => {
          [newlyMintedTokenId, anotherNewlyMintedTokenId].forEach(async function (id) {
            const assetInfo = await this.token.assetInfo(id);

            let tokenId = assetInfo[0];
            tokenId.should.be.eq.BN(id);

            let owner = assetInfo[1];
            owner.should.be.equal(_curatorAccount);

            let purchaseState = assetInfo[2];
            purchaseState.should.be.eq.BN(Unsold);

            let priceInWei = assetInfo[3];
            priceInWei.should.be.eq.BN(priceInWei);

            let auctionStartDate = assetInfo[4];
            auctionStartDate.should.be.eq.BN(auctionStartDate);
          });
        });

        it('editionInfo() returns correct data', async () => {
          [newlyMintedTokenId, anotherNewlyMintedTokenId].forEach(async function (id) {
            let editionInfo = await this.token.editionInfo(id);

            let tokenId = editionInfo[0];
            tokenId.should.be.eq.BN(id);

            let edition = editionInfo[1];
            edition.should.be.equal(_editionPhysical);

            let editionNumber = editionInfo[2];
            editionNumber.should.be.eq.BN(2);

            let tokenUri = editionInfo[3];
            tokenUri.toString().should.be.equal(_baseUri + _tokenURI);
          });
        });
      });

      describe('validates burnt tokens', async () => {

        it('does not exists()', async () => {
          [tokenToBurn, tokenToBurn + 1].forEach(async function (id) {
            let result = await this.token.exists(id);
            result.should.be.false;
          });
        });

        it('editionInfo() is empty for burnt token', async () => {
          [tokenToBurn, tokenToBurn + 1].forEach(async function (id) {
            let editionInfo = await this.token.editionInfo(id);

            let tokenId = editionInfo[0];
            tokenId.should.be.eq.BN(id);

            let edition = editionInfo[1];
            web3.utils.toAscii(edition).should.be.equal(
              '\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000'
            );

            let editionNumber = editionInfo[2];
            editionNumber.should.be.eq.BN(0);

            let tokenUri = editionInfo[3];
            tokenUri.toString().should.be.equal(_baseUri);
          });
        });

        it('assetInfo() is empty', async () => {
          [tokenToBurn, tokenToBurn + 1].forEach(async function (id) {
            const assetInfo = await this.token.assetInfo(id);

            let tokenId = assetInfo[0];
            tokenId.should.be.eq.BN(id);

            let owner = assetInfo[1];
            owner.should.be.equal(ZERO_ADDRESS);

            let purchaseState = assetInfo[2];
            purchaseState.should.be.eq.BN(0);

            let priceInWei = assetInfo[3];
            priceInWei.should.be.eq.BN(0);

            let auctionStartDate = assetInfo[4];
            auctionStartDate.should.be.eq.BN(0);
          });
        });
      });

    });

  });

  describe('resetting artist address', async () => {
    const _editionXXXDigital = web3.utils.asciiToHex('XXX0000000000DIG');

    beforeEach(async () => {
      await this.token.mint(_tokenURI, _editionXXXDigital, _priceInWei, _purchaseFromTime, _curatorAccount, {from: _curatorAccount});
    });

    it('should adjust reference to new artist account', async () => {

      let editionInfo = await this.token.editionInfo(firstTokenId);
      let artistAcc = editionInfo[4];
      artistAcc.toString().should.be.equal(_curatorAccount);

      await this.token.setArtistAccount(_editionXXXDigital, _artist, {from: _curatorAccount});

      editionInfo = await this.token.editionInfo(firstTokenId);
      artistAcc = editionInfo[4];
      artistAcc.toString().should.be.equal(_artist);
    });
  });
});
