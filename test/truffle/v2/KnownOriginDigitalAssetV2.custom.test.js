const assertRevert = require('../../helpers/assertRevert');
const etherToWei = require('../../helpers/etherToWei');
const {duration, increaseTo, advanceBlock, latest} = require('../../helpers/time');
const bnChai = require('bn-chai');

const _ = require('lodash');

const getGasCosts = require('../../helpers/getGasCosts');
const getBalance = require('../../helpers/getBalance');
const bytesToString = require('../../helpers/bytesToString');
const toBN = require('../../helpers/toBN');

const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');

require('chai')
  .use(require('chai-as-promised'))
  .use(bnChai(web3.utils.BN))
  .should();

contract('KnownOriginDigitalAssetV2 - custom', function (accounts) {

  const ROLE_KNOWN_ORIGIN = 1;
  const ROLE_MINTER = 2;
  const ROLE_UNDER_MINTER = 3;

  const _owner = accounts[0];

  const account1 = accounts[1];
  const account2 = accounts[2];
  const account3 = accounts[4];
  const account4 = accounts[5];

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const artistAccount = accounts[8];
  const artistShare = 76;

  const editionType = 1;

  const editionNumber1 = 100000;
  const editionData1 = web3.utils.asciiToHex("editionData1");
  const editionTokenUri1 = "edition1";
  const edition1Price = etherToWei(0.1);

  const editionNumber2 = 200000;
  const editionData2 = web3.utils.asciiToHex("editionData2");
  const editionTokenUri2 = "edition2";
  const edition2Price = etherToWei(0.2);

  const BASE_URI = "https://ipfs.infura.io/ipfs/";
  const MAX_UINT32 = 4294967295;

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.token = await KnownOriginDigitalAssetV2.new({from: _owner});
  });

  describe('updateKoCommissionAccount', async function () {
    it('is set on creation', async function () {
      let koCommissionAccount = await this.token.koCommissionAccount();
      koCommissionAccount.should.be.equal(_owner);
    });

    it('can be changed', async function () {
      await this.token.updateKoCommissionAccount(account1);

      let koCommissionAccount = await this.token.koCommissionAccount();
      koCommissionAccount.should.be.equal(account1);
    });

    it('only invokable from KO', async function () {
      await assertRevert(this.token.updateKoCommissionAccount(account1, {from: account1}));
    });

    it('cannot set invalid address', async function () {
      await assertRevert(this.token.updateKoCommissionAccount(ZERO_ADDRESS));
    });
  });

  describe('updateTokenBaseURI', function () {
    it('is set on creation', async function () {
      let tokenBaseURI = await this.token.tokenBaseURI();
      tokenBaseURI.should.be.equal('https://ipfs.infura.io/ipfs/');
    });

    it('can be changed', async function () {
      await this.token.updateTokenBaseURI("http://a-new-ipfs.com");

      let tokenBaseURI = await this.token.tokenBaseURI();
      tokenBaseURI.should.be.equal("http://a-new-ipfs.com");
    });

    it('only invokable from KO', async function () {
      await assertRevert(this.token.updateTokenBaseURI("http://a-new-ipfs.com", {from: account1}));
    });

    it('cannot set invalid address', async function () {
      await assertRevert(this.token.updateTokenBaseURI(""));
    });
  });

  describe('edition setup and control', async function () {

    let logs1;
    let logs2;

    beforeEach(async function () {
      let {logs: edition1Logs} = await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
      logs1 = edition1Logs;

      let highestEditionNumber = await this.token.highestEditionNumber();
      highestEditionNumber.should.be.eq.BN(editionNumber1);

      let {logs: edition2Logs} = await this.token.createActiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 4, {from: _owner});
      logs2 = edition2Logs;

      highestEditionNumber = await this.token.highestEditionNumber();
      highestEditionNumber.should.be.eq.BN(editionNumber2);
    });

    it('highestEditionNumber updated correctly', async function () {
      let highestEditionNumber = await this.token.highestEditionNumber();
      highestEditionNumber.should.be.eq.BN(editionNumber2);
    });

    it('highestEditionNumber must be higher than previously used', async function () {
      let highestEditionNumber = await this.token.highestEditionNumber();
      await assertRevert(
        this.token.createActiveEdition(highestEditionNumber, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 4, {
          from: _owner
        })
      );
    });

    describe('editionExists ', async function () {
      it('returns true when edition does exist', async function () {
        let exists = await this.token.editionExists(editionNumber1);
        exists.should.be.equal(true);
      });

      it('returns false when zero', async function () {
        let exists = await this.token.editionExists(0);
        exists.should.be.equal(false);
      });

      it('returns false when does not exist', async function () {
        let exists = await this.token.editionExists(99999);
        exists.should.be.equal(false);
      });
    });

    describe('checking raw edition data on creation', function () {

      it('edition 1 setup correctly', async function () {
        let edition = await this.token.detailsOfEdition(editionNumber1);

        bytesToString(edition[0]).should.be.equal(bytesToString(editionData1)); //_editionData
        edition[1].should.be.eq.BN(editionType); //_editionType
        edition[2].should.be.eq.BN(0); // _startDate
        edition[3].should.be.eq.BN(MAX_UINT32); // _endDate
        edition[4].should.be.equal(artistAccount); // _artistAccount
        edition[5].should.be.eq.BN(artistShare); // _artistCommission
        edition[6].should.be.eq.BN(edition1Price); // _priceInWei
        edition[7].should.be.equal(`${BASE_URI}${editionTokenUri1}`); // _tokenURI
        edition[8].should.be.eq.BN(0); // _minted
        edition[9].should.be.eq.BN(3); // _available
        edition[10].should.be.equal(true); // _active
      });

      it('edition 2 setup correctly', async function () {
        let edition = await this.token.detailsOfEdition(editionNumber2);

        bytesToString(edition[0]).should.be.equal(bytesToString(editionData2)); //_editionData
        edition[1].should.be.eq.BN(editionType); //_editionType
        edition[2].should.be.eq.BN(0); // _startDate
        edition[3].should.be.eq.BN(MAX_UINT32); // _endDate
        edition[4].should.be.equal(artistAccount); // _artistAccount
        edition[5].should.be.eq.BN(artistShare); // _artistCommission
        edition[6].should.be.eq.BN(edition2Price); // _priceInWei
        edition[7].should.be.equal(`${BASE_URI}${editionTokenUri2}`); // _tokenURI
        edition[8].should.be.eq.BN(0); // _minted
        edition[9].should.be.eq.BN(4); // _available
        edition[10].should.be.equal(true); // _active
      });

      it('editionsOfType', async function () {
        let editions = await this.token.editionsOfType(editionType);
        editions.map(e => e.toNumber()).should.be.deep.equal([editionNumber1, editionNumber2]);
      });

      describe('edition 1 query methods', function () {

        it('editionType', async function () {
          let editionType = await this.token.editionType(editionNumber1);
          editionType.should.be.eq.BN(editionType);
        });

        it('editionData', async function () {
          let editionData = await this.token.editionData(editionNumber1);
          bytesToString(editionData).should.be.equal("editionData1");
        });

        it('purchaseDatesEdition', async function () {
          let dates = await this.token.purchaseDatesEdition(editionNumber1);
          dates[0].should.be.eq.BN(0);
          dates[1].should.be.eq.BN(MAX_UINT32);
        });

        it('priceInWeiEdition', async function () {
          let priceInWei = await this.token.priceInWeiEdition(editionNumber1);
          priceInWei.should.be.eq.BN(edition1Price);
        });

        it('tokensOfEdition', async function () {
          let tokensOfEdition = await this.token.tokensOfEdition(editionNumber1);
          tokensOfEdition.should.be.deep.equal([]);
        });

        it('editionActive', async function () {
          let editionActive = await this.token.editionActive(editionNumber1);
          editionActive.should.be.equal(true);
        });

        it('totalRemaining', async function () {
          let totalRemaining = await this.token.totalRemaining(editionNumber1);
          totalRemaining.should.be.eq.BN(3);
        });

        it('totalSupplyEdition', async function () {
          let totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber1);
          totalSupplyEdition.should.be.eq.BN(0);
        });

        it('totalAvailableEdition', async function () {
          let totalAvailableEdition = await this.token.totalAvailableEdition(editionNumber1);
          totalAvailableEdition.should.be.eq.BN(3);
        });

        it('tokenURIEdition', async function () {
          let tokenURIEdition = await this.token.tokenURIEdition(editionNumber1);
          tokenURIEdition.should.be.equal(`https://ipfs.infura.io/ipfs/${editionTokenUri1}`);
        });

      });

      describe('updateStartDate', function () {
        it('can be updated by whitelist', async function () {
          await this.token.updateStartDate(editionNumber1, 123456);
          let dates = await this.token.purchaseDatesEdition(editionNumber1);
          dates[0].should.be.eq.BN(123456);
          dates[1].should.be.eq.BN(MAX_UINT32);
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updateStartDate(editionNumber1, 123456, {from: account1}));
        });
      });

      describe('updateEndDate', function () {
        it('can be updated by whitelist', async function () {
          await this.token.updateEndDate(editionNumber1, 123456);
          let dates = await this.token.purchaseDatesEdition(editionNumber1);
          dates[0].should.be.eq.BN(0);
          dates[1].should.be.eq.BN(123456);
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updateEndDate(editionNumber1, 123456, {from: account1}));
        });
      });

      describe('updateTotalAvailable', function () {
        it('can be updated by whitelist', async function () {
          await this.token.updateTotalAvailable(editionNumber1, 100);
          let available = await this.token.totalAvailableEdition(editionNumber1);
          available.should.be.eq.BN(100);
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updateTotalAvailable(editionNumber1, 100, {from: account1}));
        });

        it('reverts if updating available to below the minted amount', async function () {
          // Sell one
          await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});

          // attempt to update available to less than minted amount
          await assertRevert(this.token.updateTotalAvailable(editionNumber1, 0, {from: _owner}));
        });
      });

      describe('updateActive', function () {
        it('can be updated by whitelist', async function () {
          await this.token.updateActive(editionNumber1, false);
          let active = await this.token.editionActive(editionNumber1);
          active.should.be.equal(false);
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updateActive(editionNumber1, false, {from: account1}));
        });
      });

      describe('updateArtistsAccount', function () {
        it('can be updated by whitelist', async function () {
          let currentArtistEditions = await this.token.artistsEditions(artistAccount);
          currentArtistEditions.map(e => e.toNumber()).should.be.deep.equal([editionNumber1, editionNumber2]);

          let newArtistEditions = await this.token.artistsEditions(account3);
          newArtistEditions.map(e => e.toNumber()).should.be.deep.equal([]);

          await this.token.updateArtistsAccount(editionNumber1, account3);

          currentArtistEditions = await this.token.artistsEditions(artistAccount);
          currentArtistEditions.map(e => e.toNumber()).should.be.deep.equal([0, editionNumber2]);

          newArtistEditions = await this.token.artistsEditions(account3);
          newArtistEditions.map(e => e.toNumber()).should.be.deep.equal([editionNumber1]);
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updateArtistsAccount(editionNumber1, account3, {from: account1}));
        });
      });

      describe('updateEditionType', function () {
        it('can be updated by whitelist', async function () {
          const type2 = 99;

          let currentEditions = await this.token.editionsOfType(editionType);
          currentEditions.map(e => e.toNumber()).should.be.deep.equal([editionNumber1, editionNumber2]);

          let newEditions = await this.token.editionsOfType(type2);
          newEditions.map(e => e.toNumber()).should.be.deep.equal([]);

          await this.token.updateEditionType(editionNumber1, type2);

          currentEditions = await this.token.editionsOfType(editionType);
          currentEditions.map(e => e.toNumber()).should.be.deep.equal([0, editionNumber2]);

          newEditions = await this.token.editionsOfType(type2);
          newEditions.map(e => e.toNumber()).should.be.deep.equal([editionNumber1]);
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updateArtistsAccount(editionNumber1, account3, {from: account1}));
        });
      });

      describe('updatePriceInWei', function () {
        it('can be updated by whitelist', async function () {
          await this.token.updatePriceInWei(editionNumber1, etherToWei(1));
          let price = await this.token.priceInWeiEdition(editionNumber1);
          price.should.be.eq.BN(etherToWei(1));
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updatePriceInWei(editionNumber1, etherToWei(1), {from: account1}));
        });

        it('should fail when edition not valid', async function () {
          await assertRevert(this.token.updatePriceInWei(999, etherToWei(1)));
        });
      });

      describe('updateArtistCommission', function () {
        it('can be updated by whitelist', async function () {
          await this.token.updateArtistCommission(editionNumber1, 10);
          let artistCommission = await this.token.artistCommission(editionNumber1);
          artistCommission[1].should.be.eq.BN(10);
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updateArtistCommission(editionNumber1, 10, {from: account1}));
        });

        it('should fail when edition not valid', async function () {
          await assertRevert(this.token.updateArtistCommission(999, 10));
        });
      });

      describe('updateEditionTokenURI', function () {
        it('can be updated by whitelist', async function () {
          await this.token.updateEditionTokenURI(editionNumber1, "newUri");
          let uri = await this.token.tokenURIEdition(editionNumber1);
          uri.should.be.equal("https://ipfs.infura.io/ipfs/newUri");
        });

        it('should fail when not whitelisted', async function () {
          await assertRevert(this.token.updateEditionTokenURI(editionNumber1, "newUri", {from: account1}));
        });
      });
    });

    describe('creating disabled editions', function () {

      const editionNumber3 = 300000;
      const editionData3 = web3.utils.asciiToHex("editionData3");
      const editionTokenUri3 = "edition3";
      const edition3Price = etherToWei(0.3);

      beforeEach(async function () {
        await this.token.createInactiveEdition(editionNumber3, editionData3, editionType, 0, 0, artistAccount, artistShare, edition3Price, editionTokenUri3, 1, {from: _owner});
      });

      it('edition 3 setup correctly', async function () {
        let edition = await this.token.detailsOfEdition(editionNumber3);

        bytesToString(edition[0]).should.be.equal("editionData3"); //_editionData
        edition[1].should.be.eq.BN(editionType); //_editionType
        edition[2].should.be.eq.BN(0); // _startDate
        edition[3].should.be.eq.BN(MAX_UINT32); // _endDate
        edition[4].should.be.equal(artistAccount); // _artistAccount
        edition[5].should.be.eq.BN(artistShare); // _artistCommission
        edition[6].should.be.eq.BN(edition3Price); // _priceInWei
        edition[7].should.be.equal(`${BASE_URI}${editionTokenUri3}`); // _tokenURI
        edition[8].should.be.eq.BN(0); // _minted
        edition[9].should.be.eq.BN(1); // _available
        edition[10].should.be.equal(false); // _active
      });

      it('editionActive', async function () {
        let active = await this.token.editionActive(editionNumber3);
        active.should.be.equal(false);
      });

    });

    describe('creating disabled full edition', async function () {

      const editionNumber3 = 300000;
      const editionData3 = web3.utils.asciiToHex("editionData3");
      const editionTokenUri3 = "edition3";
      const edition3Price = etherToWei(0.3);

      beforeEach(async function () {
        await this.token.createInactivePreMintedEdition(editionNumber3, editionData3, editionType, 0, 0, artistAccount, artistShare, edition3Price, editionTokenUri3, 1, 3, {from: _owner});
      });

      it('highestEditionNumber updated correctly', async function () {
        let highestEditionNumber = await this.token.highestEditionNumber();
        highestEditionNumber.should.be.eq.BN(editionNumber3);
      });

      it('edition setup correctly', async function () {
        let edition = await this.token.detailsOfEdition(editionNumber3);

        bytesToString(edition[0]).should.be.equal("editionData3"); //_editionData
        edition[1].should.be.eq.BN(editionType); //_editionType
        edition[2].should.be.eq.BN(0); // _startDate
        edition[3].should.be.eq.BN(MAX_UINT32); // _endDate
        edition[4].should.be.equal(artistAccount); // _artistAccount
        edition[5].should.be.eq.BN(artistShare); // _artistCommission
        edition[6].should.be.eq.BN(edition3Price); // _priceInWei
        edition[7].should.be.equal(`${BASE_URI}${editionTokenUri3}`); // _tokenURI
        edition[8].should.be.eq.BN(1); // _minted
        edition[9].should.be.eq.BN(3); // _available
        edition[10].should.be.equal(false); // _active
      });

      it('editionActive', async function () {
        let active = await this.token.editionActive(editionNumber3);
        active.should.be.equal(false);
      });

      describe('edition query methods', function () {

        it('purchaseDatesEdition', async function () {
          let dates = await this.token.purchaseDatesEdition(editionNumber3);
          dates[0].should.be.eq.BN(0);
          dates[1].should.be.eq.BN(MAX_UINT32);
        });

        it('priceInWeiEdition', async function () {
          let priceInWei = await this.token.priceInWeiEdition(editionNumber3);
          priceInWei.should.be.eq.BN(edition3Price);
        });

        it('tokensOfEdition', async function () {
          let tokensOfEdition = await this.token.tokensOfEdition(editionNumber3);
          tokensOfEdition.should.be.deep.equal([]);
        });

        it('editionActive', async function () {
          let editionActive = await this.token.editionActive(editionNumber3);
          editionActive.should.be.equal(false);
        });

        it('totalRemaining', async function () {
          let totalRemaining = await this.token.totalRemaining(editionNumber3);
          totalRemaining.should.be.eq.BN(2);
        });

        it('totalSupplyEdition', async function () {
          let totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber3);
          totalSupplyEdition.should.be.eq.BN(1);
        });

        it('totalAvailableEdition', async function () {
          let totalAvailableEdition = await this.token.totalAvailableEdition(editionNumber3);
          totalAvailableEdition.should.be.eq.BN(3);
        });

        it('tokenURIEdition', async function () {
          let tokenURIEdition = await this.token.tokenURIEdition(editionNumber3);
          tokenURIEdition.should.be.equal(`https://ipfs.infura.io/ipfs/${editionTokenUri3}`);
        });

      });
    });

    describe('edition creation validation', async function () {

      describe('createActiveEdition', async function () {
        const editionNumber3 = 300000;

        it('reverts if editionNumber zero', async function () {
          await assertRevert(
            this.token.createActiveEdition(0, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if editionType zero', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber3, editionData1, 0, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if tokenURI is not provided', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber3, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, "", 3, {from: _owner})
          );
        });

        it('reverts if artistAccount is not valid', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber3, editionData1, editionType, 0, 0, ZERO_ADDRESS, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if artistShare is greater than 100%', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber3, editionData1, editionType, 0, 0, artistAccount, 101, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if artistShare is less than 0%', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber3, editionData1, editionType, 0, 0, artistAccount, -1, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if editionNumber already defined', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if editionNumber less than previous created', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber1 - 1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });
      });

      describe('createInactiveEdition', async function () {
        const editionNumber3 = 300000;

        it('reverts if editionNumber zero', async function () {
          await assertRevert(
            this.token.createInactiveEdition(0, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if editionType zero', async function () {
          await assertRevert(
            this.token.createInactiveEdition(editionNumber3, editionData1, 0, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if tokenURI is not provided', async function () {
          await assertRevert(
            this.token.createInactiveEdition(editionNumber3, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, "", 3, {from: _owner})
          );
        });

        it('reverts if artistAccount is not valid', async function () {
          await assertRevert(
            this.token.createInactiveEdition(editionNumber3, editionData1, editionType, 0, 0, ZERO_ADDRESS, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if artistShare is greater than 100%', async function () {
          await assertRevert(
            this.token.createInactiveEdition(editionNumber3, editionData1, editionType, 0, 0, artistAccount, 101, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if artistShare is less than 0%', async function () {
          await assertRevert(
            this.token.createInactiveEdition(editionNumber3, editionData1, editionType, 0, 0, artistAccount, -1, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if editionNumber already defined', async function () {
          await assertRevert(
            this.token.createInactiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });

        it('reverts if editionNumber less than previous created', async function () {
          await assertRevert(
            this.token.createInactiveEdition(editionNumber1 - 1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
        });
      });

      describe('prevent clashing edition numbers', async function () {

        it('successful if edition number greater than previous + total available', async function () {
          const editionNumber1HigherThanPrevious = editionNumber2 + 5;
          await this.token.createActiveEdition(editionNumber1HigherThanPrevious, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});

          let highestEditionNumber = await this.token.highestEditionNumber();
          highestEditionNumber.should.be.eq.BN(editionNumber1HigherThanPrevious);
        });

        it('fails if edition number equal than previous + total available', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber2 + 4, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
          let highestEditionNumber = await this.token.highestEditionNumber();
          highestEditionNumber.should.be.eq.BN(editionNumber2);
        });

        it('fails if edition number less than previous + total available', async function () {
          await assertRevert(
            this.token.createActiveEdition(editionNumber2 + 3, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner})
          );
          let highestEditionNumber = await this.token.highestEditionNumber();
          highestEditionNumber.should.be.eq.BN(editionNumber2);
        });

      });
    });

    describe('edition event emitted', async function () {

      it('edition 1 creation event', async function () {
        logs1.length.should.be.equal(1);
        logs1[0].event.should.be.equal('EditionCreated');

        logs1[0].args._editionNumber.should.be.eq.BN(editionNumber1);
        bytesToString(logs1[0].args._editionData).should.be.equal("editionData1");
        logs1[0].args._editionType.should.be.eq.BN(editionType);
      });

      it('edition 2 creation event', async function () {
        logs2.length.should.be.equal(1);
        logs2[0].event.should.be.equal('EditionCreated');

        logs2[0].args._editionNumber.should.be.eq.BN(editionNumber2);
        bytesToString(logs2[0].args._editionData).should.be.equal("editionData2");
        logs2[0].args._editionType.should.be.eq.BN(editionType);
      });
    });
  });

  describe('token setup and controls', async function () {

    const tokenId1 = 100001;
    const tokenId2 = 200001;
    const tokenId3 = 100002;
    const tokenId4 = 200002;

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
      await this.token.createActiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 4, {from: _owner});
    });

    beforeEach(async function () {
      await this.token.purchase(editionNumber1, {from: account1, value: edition1Price}); // tokenId 100001
      await this.token.purchase(editionNumber2, {from: account2, value: edition2Price}); // tokenId 200001
      await this.token.purchase(editionNumber1, {from: account2, value: edition1Price}); // tokenId 100002
      await this.token.purchase(editionNumber2, {from: account3, value: edition2Price}); // tokenId 200002
    });

    describe('setTokenURI', async function () {
      it('can be changed by KO', async function () {
        let tokenURI = await this.token.tokenURI(tokenId1);
        tokenURI.should.be.equal(`${BASE_URI}${editionTokenUri1}`);

        const newTokenUri = "my-new-token-uri";
        await this.token.setTokenURI(tokenId1, newTokenUri);

        tokenURI = await this.token.tokenURI(tokenId1);
        tokenURI.should.be.equal(`${BASE_URI}${newTokenUri}`);
      });

      it('is rejected unless whitelisted', async function () {
        await assertRevert(this.token.setTokenURI(tokenId1, "new-uri", {from: account3}));
      });
    });

    describe('editionOfTokenId', async function () {
      it('will return the correct edition ', async function () {
        let result1 = await this.token.editionOfTokenId(tokenId1);
        result1.should.be.eq.BN(editionNumber1);

        let result2 = await this.token.editionOfTokenId(tokenId2);
        result2.should.be.eq.BN(editionNumber2);

        let result3 = await this.token.editionOfTokenId(tokenId3);
        result3.should.be.eq.BN(editionNumber1);

        let result4 = await this.token.editionOfTokenId(tokenId4);
        result4.should.be.eq.BN(editionNumber2);
      });
    });

    describe('tokenURI', async function () {
      it('will return the correct edition ', async function () {
        let result1 = await this.token.tokenURI(tokenId1);
        result1.should.be.equal(`${BASE_URI}${editionTokenUri1}`);

        let result2 = await this.token.tokenURI(tokenId2);
        result2.should.be.equal(`${BASE_URI}${editionTokenUri2}`);

        let result3 = await this.token.tokenURI(tokenId3);
        result3.should.be.equal(`${BASE_URI}${editionTokenUri1}`);

        let result4 = await this.token.tokenURI(tokenId4);
        result4.should.be.equal(`${BASE_URI}${editionTokenUri2}`);
      });

      it('will revert when invalid token ID', async function () {
        await assertRevert(this.token.tokenURI(99));
      });
    });

    describe('tokenURISafe', async function () {

      it('will return the correct edition ', async function () {
        let result1 = await this.token.tokenURISafe(tokenId1);
        result1.should.be.equal(`${BASE_URI}${editionTokenUri1}`);

        let result2 = await this.token.tokenURISafe(tokenId2);
        result2.should.be.equal(`${BASE_URI}${editionTokenUri2}`);

        let result3 = await this.token.tokenURISafe(tokenId3);
        result3.should.be.equal(`${BASE_URI}${editionTokenUri1}`);

        let result4 = await this.token.tokenURISafe(tokenId4);
        result4.should.be.equal(`${BASE_URI}${editionTokenUri2}`);
      });

      it('will NOT revert when invalid token ID', async function () {
        let result = await this.token.tokenURISafe(99);
        result.should.be.equal(`${BASE_URI}`);
      });

    });

    describe('tokensOfEdition', async function () {

      it('will return the correct edition ', async function () {
        let result1 = await this.token.tokensOfEdition(editionNumber1);
        result1.map(e => e.toNumber()).should.be.deep.equal([tokenId1, tokenId3]);

        let result2 = await this.token.tokensOfEdition(editionNumber2);
        result2.map(e => e.toNumber()).should.be.deep.equal([tokenId2, tokenId4]);
      });
    });

    describe('purchaseDatesToken', async function () {

      it('will return the correct edition ', async function () {
        [tokenId1, tokenId2, tokenId3, tokenId4].forEach(async (tokenId) => {
          let {_startDate, _endDate} = await this.token.purchaseDatesToken(tokenId);
          _startDate.should.be.eq.BN(0);
          _endDate.should.be.eq.BN(MAX_UINT32);
        });
      });

    });

    describe('priceInWeiToken', async function () {

      it('will return the correct edition ', async function () {
        let result1 = await this.token.priceInWeiToken(tokenId1);
        result1.should.be.eq.BN(edition1Price);

        let result2 = await this.token.priceInWeiToken(tokenId2);
        result2.should.be.eq.BN(edition2Price);

        let result3 = await this.token.priceInWeiToken(tokenId3);
        result3.should.be.eq.BN(edition1Price);

        let result4 = await this.token.priceInWeiToken(tokenId4);
        result4.should.be.eq.BN(edition2Price);
      });

    });

    describe('artistsEditions', async function () {

      it('will return the correct data ', async function () {
        let editions = await this.token.artistsEditions(artistAccount);
        editions.map(e => e.toNumber())
          .should.be.deep.equal([editionNumber1, editionNumber2]);
      });

    });
  });

  describe('mint', async function () {

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
      await this.token.createActiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 4, {from: _owner});
    });

    describe('validation', async function () {
      it('reverts if edition sold out', async function () {
        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});

        // Reverts on 4 mint as sold out
        await assertRevert(this.token.purchase(editionNumber1, {from: account1, value: edition1Price}));
      });

      it('reverts if edition not active', async function () {
        await this.token.updateActive(editionNumber1, false, {from: _owner});

        // reverts as inactive
        await assertRevert(this.token.purchase(editionNumber1, {from: account1, value: edition1Price}));
      });

      it('reverts if edition invalid', async function () {
        await this.token.updateTotalAvailable(editionNumber1, 0, {from: _owner});

        // reverts as edition sat to zero available
        await assertRevert(this.token.purchase(editionNumber1, {from: account1, value: edition1Price}));
      });

      it('reverts if purchase price not provided', async function () {
        await assertRevert(this.token.purchase(editionNumber1, {from: account1, value: 0}));
      });
    });

    describe('purchase successful', async function () {
      const tokenId1_1 = 100001;
      const tokenId1_2 = 100002;
      const tokenId1_3 = 100003;

      const tokenId2_1 = 200001;
      const tokenId2_2 = 200002;
      const tokenId2_3 = 200003;

      beforeEach(async function () {
        // 3 from edition 2
        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
        await this.token.purchase(editionNumber1, {from: account2, value: edition1Price});
        await this.token.purchase(editionNumber1, {from: account3, value: edition1Price});

        // 3 from edition 1
        await this.token.purchase(editionNumber2, {from: account1, value: edition2Price});
        await this.token.purchase(editionNumber2, {from: account2, value: edition2Price});
        await this.token.purchase(editionNumber2, {from: account3, value: edition2Price});
      });

      it('sets token Uri', async function () {
        [tokenId1_1, tokenId1_2, tokenId1_3].forEach(async (id) => {
          let result = await this.token.tokenURI(id);
          result.should.be.equal(`${BASE_URI}${editionTokenUri1}`);
        });

        [tokenId2_1, tokenId2_2, tokenId2_3].forEach(async (id) => {
          let result = await this.token.tokenURI(id);
          result.should.be.equal(`${BASE_URI}${editionTokenUri2}`);
        });
      });

      it('adds to the number minted counter', async function () {
        let totalNumberMinted = await this.token.totalNumberMinted();
        totalNumberMinted.should.be.eq.BN(6);
      });

      it('adds to the number of wei collected', async function () {
        let expect = edition1Price.mul(toBN(3)).add(edition2Price.mul(toBN(3)));

        let totalPurchaseValueInWei = await this.token.totalPurchaseValueInWei();
        totalPurchaseValueInWei.should.be.eq.BN(expect);
      });

      it('adds to edition <-> tokenId[] mappings', async function () {
        let edition1Tokens = await this.token.tokensOfEdition(editionNumber1);
        edition1Tokens
          .map(e => e.toNumber())
          .should.be.deep.equal([tokenId1_1, tokenId1_2, tokenId1_3]);

        let edition2Tokens = await this.token.tokensOfEdition(editionNumber2);
        edition2Tokens
          .map(e => e.toNumber())
          .should.be.deep.equal([tokenId2_1, tokenId2_2, tokenId2_3]);
      });

      it('adds to tokenId <-> edition mappings', async function () {
        [tokenId1_1, tokenId1_2, tokenId1_3].forEach(async (id) => {
          let result = await this.token.editionOfTokenId(id);
          result.should.be.eq.BN(editionNumber1);
        });

        [tokenId2_1, tokenId2_2, tokenId2_3].forEach(async (id) => {
          let result = await this.token.editionOfTokenId(id);
          result.should.be.eq.BN(editionNumber2);
        });
      });

      it('tokensOf', async function () {
        let account1Results = await this.token.tokensOf(account1);
        account1Results
          .map(e => e.toNumber())
          .should.be.deep.equal([tokenId1_1, tokenId2_1]);

        let account2Results = await this.token.tokensOf(account2);
        account2Results
          .map(e => e.toNumber())
          .should.be.deep.equal([tokenId1_2, tokenId2_2]);

        let account3Results = await this.token.tokensOf(account3);
        account3Results
          .map(e => e.toNumber())
          .should.be.deep.equal([tokenId1_3, tokenId2_3]);
      });

    });

    describe('handling of funds without optional commission', async function () {
      let originalAccount1Balance;
      let originalAccount2Balance;
      let originalKoAccountBalance;
      let originalArtistAccountBalance;

      let postAccount1Balance;
      let postAccount2Balance;
      let postKoAccountBalance;
      let postArtistAccountBalance;

      let receiptAccount1;
      let receiptAccount2;

      let account1GasFees;
      let account2GasFees;

      beforeEach(async function () {
        // pre balances
        originalAccount1Balance = await getBalance(account1);
        originalAccount2Balance = await getBalance(account2);
        originalKoAccountBalance = await getBalance(await this.token.koCommissionAccount());
        originalArtistAccountBalance = await getBalance(artistAccount);

        // account 1 purchases edition 1
        receiptAccount1 = await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
        account1GasFees = await getGasCosts(receiptAccount1);

        // account 2 purchases another from edition 1
        receiptAccount2 = await this.token.purchase(editionNumber1, {from: account2, value: edition1Price});
        account2GasFees = await getGasCosts(receiptAccount2);

        // post balances
        postAccount1Balance = await getBalance(account1);
        postAccount2Balance = await getBalance(account2);
        postKoAccountBalance = await getBalance(await this.token.koCommissionAccount());
        postArtistAccountBalance = await getBalance(artistAccount);
      });

      it('splits funds between artist and KO account', async function () {
        console.log(`GasUsed Account 1: ${account1GasFees}`);
        console.log(`GasUsed Account 2: ${account2GasFees}`);

        // account 1 should be equal the cost of transaction, minus the edition cost
        postAccount1Balance.should.be.eq.BN(
          originalAccount1Balance.sub(
            account1GasFees.add(edition1Price)
          )
        );

        // account 2 should be equal the cost of transaction, minus the edition cost
        postAccount2Balance.should.be.eq.BN(
          originalAccount2Balance.sub(
            account2GasFees.add(edition1Price)
          )
        );

        // ensure KO gets a the correct cut
        postKoAccountBalance.should.be.eq.BN(
          originalKoAccountBalance.add(
            edition1Price
              .div(toBN(100))
              .mul(toBN(24)) // 24% goes to KO
              .mul(toBN(2)) // 2 x sales for edition 1
          )
        );

        // ensure artists get the correct 76% commission
        postArtistAccountBalance.should.be.eq.BN(
          originalArtistAccountBalance.add(
            edition1Price
              .div(toBN(100))
              .mul(toBN(76)) // 24% goes to KO
              .mul(toBN(2)) // 2 x sales for edition 1
          )
        );
      });

      it('Transfer event emitted', async function () {
        let {logs} = receiptAccount1;

        let transferEvent = logs[0];

        transferEvent.event.should.be.equal('Transfer');

        let {_from, _to, _tokenId} = transferEvent.args;
        _from.should.be.equal('0x0000000000000000000000000000000000000000');
        _to.should.be.equal(account1);
        _tokenId.should.be.eq.BN(editionNumber1 + 1);
      });

      it('Minted event emitted', async function () {
        let {logs} = receiptAccount1;

        let mintedEvent = logs[1];

        mintedEvent.event.should.be.equal('Minted');

        let {_buyer, _editionNumber, _tokenId} = mintedEvent.args;
        _buyer.should.be.equal(account1);
        _editionNumber.should.be.eq.BN(editionNumber1);
        _tokenId.should.be.eq.BN(editionNumber1 + 1);
      });

      it('Purchase event emitted', async function () {
        let {logs} = receiptAccount1;

        let purchasedEvent = logs[2];

        purchasedEvent.event.should.be.equal('Purchase');

        let {_buyer, _priceInWei, _tokenId} = purchasedEvent.args;
        _buyer.should.be.equal(account1);
        _priceInWei.should.be.eq.BN(edition1Price);
        _tokenId.should.be.eq.BN(editionNumber1 + 1);
      });

    });

    describe('tokenData', async function () {
      const tokenId1 = editionNumber1 + 1;
      const tokenId2 = editionNumber2 + 1;
      const tokenIdInvalid = 999;

      beforeEach(async function () {
        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
        await this.token.purchase(editionNumber2, {from: account2, value: edition2Price});
      });

      it('should revert is token ID not valid', async function () {
        await assertRevert(this.token.tokenData(tokenIdInvalid));
      });

      it(`token id [${tokenId1}]`, async function () {
        let results = await this.token.tokenData(tokenId1);

        results[0].should.be.eq.BN(editionNumber1);
        results[1].should.be.eq.BN(editionType);
        bytesToString(results[2]).should.be.equal("editionData1");
        results[3].should.be.equal(`https://ipfs.infura.io/ipfs/edition1`);
        results[4].should.be.equal(account1);
      });

      it(`token id [${tokenId2}]`, async function () {
        let results = await this.token.tokenData(tokenId2);

        results[0].should.be.eq.BN(editionNumber2);
        results[1].should.be.eq.BN(editionType);
        bytesToString(results[2]).should.be.equal("editionData2");
        results[3].should.be.equal(`https://ipfs.infura.io/ipfs/edition2`);
        results[4].should.be.equal(account2);
      });
    });

    describe('tokenData', async function () {
      const tokenId1 = editionNumber1 + 1;
      const tokenId2 = editionNumber2 + 1;
      const tokenIdInvalid = 999;

      beforeEach(async function () {
        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
        await this.token.purchase(editionNumber2, {from: account2, value: edition2Price});
      });

      it('should revert is token ID not valid', async function () {
        await assertRevert(this.token.tokenData(tokenIdInvalid));
      });

      it(`token id [${tokenId1}]`, async function () {
        let results = await this.token.tokenData(tokenId1);

        results[0].should.be.eq.BN(editionNumber1);
        results[1].should.be.eq.BN(editionType);
        bytesToString(results[2]).should.be.equal("editionData1");
        results[3].should.be.equal(`${BASE_URI}${editionTokenUri1}`);
        results[4].should.be.equal(account1);
      });

      it(`token id [${tokenId2}]`, async function () {
        let results = await this.token.tokenData(tokenId2);

        results[0].should.be.eq.BN(editionNumber2);
        results[1].should.be.eq.BN(editionType);
        bytesToString(results[2]).should.be.equal("editionData2");
        results[3].should.be.equal(`${BASE_URI}${editionTokenUri2}`);
        results[4].should.be.equal(account2);
      });
    });
  });

  describe('handle start & end dates', async function () {

    let startDate = 0;
    let endDate = 0; // set to zero to be set to default max uint32

    beforeEach(async function () {
      let tokens = await this.token.tokensOf(account1);
      tokens.map(e => e.toNumber()).should.be.deep.equal([]);
    });

    describe('starts in the future', async function () {
      beforeEach(async function () {
        // starts in 30 seconds
        startDate = (await latest()) + duration.seconds(30);

        await this.token.createActiveEdition(editionNumber1, editionData1, editionType, startDate, endDate, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
      });

      it('reverts if edition auction not started', async function () {
        await assertRevert(this.token.purchase(editionNumber1, {from: account1, value: edition1Price}));
      });

      it('once updated the purchase will succeed', async function () {
        startDate = (await latest()) - duration.seconds(30); // lower start time to in the past
        await this.token.updateStartDate(editionNumber1, startDate, {from: _owner});

        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});

        let tokens = await this.token.tokensOf(account1);
        tokens
          .map(e => e.toNumber())
          .should.be.deep.equal([editionNumber1 + 1]);
      });
    });

    describe('ends before being purchased', async function () {
      beforeEach(async function () {
        // ends in 30 seconds
        endDate = (await latest()) + duration.seconds(30);

        await this.token.createActiveEdition(editionNumber1, editionData1, editionType, startDate, endDate, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});

        // force time to move 1 minute
        await increaseTo((await latest()) + duration.minutes(1));
      });

      it('reverts if edition auction closed', async function () {
        await assertRevert(this.token.purchase(editionNumber1, {from: account1, value: edition1Price}));
      });

      it('once updated the purchase will succeed', async function () {
        endDate = (await latest()) + duration.minutes(2); // increase start time to in the future
        await this.token.updateEndDate(editionNumber1, endDate, {from: _owner});

        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});

        let tokens = await this.token.tokensOf(account1);
        tokens
          .map(e => e.toNumber())
          .should.be.deep.equal([editionNumber1 + 1]);
      });
    });
  });

  describe('handling optional commission splits on purchase', async function () {

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
    });

    describe('optional commissions are applied when found', async function () {

      let originalAccount1Balance;
      let originalKoAccountBalance;
      let originalArtistAccountBalance;
      let originalOptionalAccountBalance;

      let postAccount1Balance;
      let postKoAccountBalance;
      let postArtistAccountBalance;
      let postOptionalAccountBalance;

      let receiptAccount1;
      let account1GasFees;

      let optionalAccount = account2;
      let optionalRate = 5;

      beforeEach(async function () {
        await this.token.updateOptionalCommission(editionNumber1, optionalRate, optionalAccount, {from: _owner});
      });

      beforeEach(async function () {
        // pre balances
        originalAccount1Balance = await getBalance(account1);
        originalOptionalAccountBalance = await getBalance(optionalAccount);
        originalKoAccountBalance = await getBalance(await this.token.koCommissionAccount());
        originalArtistAccountBalance = await getBalance(artistAccount);

        // account 1 purchases edition 1
        receiptAccount1 = await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
        account1GasFees = await getGasCosts(receiptAccount1);

        // post balances
        postAccount1Balance = await getBalance(account1);
        postOptionalAccountBalance = await getBalance(optionalAccount);
        postKoAccountBalance = await getBalance(await this.token.koCommissionAccount());
        postArtistAccountBalance = await getBalance(artistAccount);
      });

      it('splits funds between artist, optional & KO account', async function () {
        console.log(`GasUsed Account 1: ${account1GasFees}`);

        // account 1 should be equal the cost of transaction, minus the edition cost
        postAccount1Balance.should.be.eq.BN(
          originalAccount1Balance.sub(
            account1GasFees.add(edition1Price)
          )
        );

        // ensure artists get the correct 76% commission
        postArtistAccountBalance.should.be.eq.BN(
          originalArtistAccountBalance.add(
            edition1Price
              .div(toBN(100))
              .mul(toBN(76)) // 24% goes to KO
          )
        );

        // ensure optional account gets the correct 5% commission
        postOptionalAccountBalance.should.be.eq.BN(
          originalOptionalAccountBalance.add(
            edition1Price
              .div(toBN(100))
              .mul(toBN(5)) // 5% goes to optional account
          )
        );

        // ensure KO gets a the correct cut
        postKoAccountBalance.should.be.eq.BN(
          originalKoAccountBalance.add(
            edition1Price
              .div(toBN(100))
              .mul(toBN(100 - (76 + 5))) // 19% goes to KO
          )
        );
      });

    });

    describe('over spends are absorbed by KO', async function () {

      let originalAccount1Balance;
      let originalKoAccountBalance;
      let originalArtistAccountBalance;

      let postAccount1Balance;
      let postKoAccountBalance;
      let postArtistAccountBalance;

      let receiptAccount1;
      let account1GasFees;

      const overspend = etherToWei(0.1);

      beforeEach(async function () {
        // pre balances
        originalAccount1Balance = await getBalance(account1);
        originalKoAccountBalance = await getBalance(await this.token.koCommissionAccount());
        originalArtistAccountBalance = await getBalance(artistAccount);

        // account 1 purchases edition 1
        receiptAccount1 = await this.token.purchase(editionNumber1, {
          from: account1,
          value: edition1Price.add(overspend) // add the overspend
        });
        account1GasFees = await getGasCosts(receiptAccount1);

        // post balances
        postAccount1Balance = await getBalance(account1);
        postKoAccountBalance = await getBalance(await this.token.koCommissionAccount());
        postArtistAccountBalance = await getBalance(artistAccount);
      });

      it('splits funds between artist, optional & KO account', async function () {
        // account 1 should be equal the cost of transaction, minus the edition cost
        postAccount1Balance.should.be.eq.BN(
          originalAccount1Balance.sub(
            account1GasFees
              .add(edition1Price)
              .add(overspend) // overspend lost
          )
        );

        // ensure artists get the correct 76% commission
        postArtistAccountBalance.should.be.eq.BN(
          originalArtistAccountBalance.add(
            edition1Price
              .div(toBN(100))
              .mul(toBN(76)) // 24% goes to KO
          )
        );

        // ensure KO gets a the correct cut
        postKoAccountBalance.should.be.eq.BN(
          originalKoAccountBalance
            .add(
              edition1Price
                .div(toBN(100))
                .mul(toBN(24)) // 24% goes to KO
            )
            .add(overspend) // over spend absorbed
        );
      });

    });

    describe('commission can be updated', async function () {
      beforeEach(async function () {
        await this.token.updateOptionalCommission(editionNumber1, 5, account1, {from: _owner});
      });

      it('correct values are set', async function () {
        let commission = await this.token.editionOptionalCommission(editionNumber1);
        commission[0].should.be.eq.BN(5);
        commission[1].should.be.equal(account1);
      });
    });

    describe('validation', async function () {
      it('should prevent setting commission rate without a invalid address', async function () {
        await assertRevert(this.token.updateOptionalCommission(editionNumber1, 1, ZERO_ADDRESS, {
          from: _owner
        }));
      });

      it('should prevent setting commission rate without a invalid edition', async function () {
        await assertRevert(this.token.updateOptionalCommission(999, 1, account1, {
          from: _owner
        }));
      });

      it('should prevent setting commission with more than 100%', async function () {
        await assertRevert(this.token.updateOptionalCommission(editionNumber1, 25, account1, {
          from: _owner
        }));
      });
    });

    describe('commission can be cleared', async function () {

      beforeEach(async function () {
        await this.token.updateOptionalCommission(editionNumber1, 5, account1, {from: _owner});
      });

      it('reset to zero', async function () {
        let commission = await this.token.editionOptionalCommission(editionNumber1);
        commission[0].should.be.eq.BN(5);
        commission[1].should.be.equal(account1);

        await this.token.updateOptionalCommission(editionNumber1, 0, ZERO_ADDRESS, {from: _owner});

        commission = await this.token.editionOptionalCommission(editionNumber1);
        commission[0].should.be.eq.BN(0);
        commission[1].should.be.equal(ZERO_ADDRESS);
      });
    });

  });

  describe('mint', async function () {

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
      await this.token.createActiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 4, {from: _owner});
    });

    it('will revert if not called by whitelist', async function () {
      await assertRevert(this.token.mint(account3, editionNumber1, {from: account1}));
    });

    it('once added to whitelist can mint successfully', async function () {
      let tokens = await this.token.tokensOf(account3);
      tokens
        .map(e => e.toNumber())
        .should.be.deep.equal([]);

      await assertRevert(this.token.mint(account3, editionNumber1, {from: account1}));

      await this.token.addAddressToAccessControl(account1, ROLE_MINTER, {from: _owner});

      await this.token.mint(account3, editionNumber1, {from: account1});

      tokens = await this.token.tokensOf(account3);
      tokens
        .map(e => e.toNumber())
        .should.be.deep.equal([editionNumber1 + 1]);
    });

    describe('successful mint without paying fee', async function () {

      const tokenId1 = editionNumber1 + 1;
      const tokenId2 = editionNumber2 + 1;

      let receipt;

      beforeEach(async function () {
        receipt = await this.token.mint(account3, editionNumber1, {from: _owner});
        await this.token.mint(account4, editionNumber2, {from: _owner});
      });

      describe('tokenData', async function () {
        it(`token id [${tokenId1}]`, async function () {
          let results = await this.token.tokenData(tokenId1);

          results[0].should.be.eq.BN(editionNumber1);
          results[1].should.be.eq.BN(editionType);
          bytesToString(results[2]).should.be.equal("editionData1");
          results[3].should.be.equal(`https://ipfs.infura.io/ipfs/edition1`);
          results[4].should.be.equal(account3);
        });

        it(`token id [${tokenId2}]`, async function () {
          let results = await this.token.tokenData(tokenId2);

          results[0].should.be.eq.BN(editionNumber2);
          results[1].should.be.eq.BN(editionType);
          bytesToString(results[2]).should.be.equal("editionData2");
          results[3].should.be.equal(`https://ipfs.infura.io/ipfs/edition2`);
          results[4].should.be.equal(account4);
        });
      });

      describe('tokensOf', async function () {
        it(`ownership of [${tokenId1}] is defined`, async function () {
          let tokens = await this.token.tokensOf(account3);
          tokens
            .map(e => e.toNumber())
            .should.be.deep.equal([tokenId1]);
        });

        it(`ownership of [${tokenId2}] is defined`, async function () {
          let tokens = await this.token.tokensOf(account4);
          tokens
            .map(e => e.toNumber())
            .should.be.deep.equal([tokenId2]);
        });
      });

      describe(`events emitted [${tokenId1}]`, async function () {

        it('Transfer event emitted', async function () {
          let {logs} = receipt;

          let transferEvent = logs[0];

          transferEvent.event.should.be.equal('Transfer');

          let {_from, _to, _tokenId} = transferEvent.args;
          _from.should.be.equal('0x0000000000000000000000000000000000000000');
          _to.should.be.equal(account3);
          _tokenId.should.be.eq.BN(tokenId1);
        });

        it('Minted event emitted', async function () {
          let {logs} = receipt;

          let mintedEvent = logs[1];

          mintedEvent.event.should.be.equal('Minted');

          let {_buyer, _editionNumber, _tokenId} = mintedEvent.args;
          _buyer.should.be.equal(account3);
          _editionNumber.should.be.eq.BN(editionNumber1);
          _tokenId.should.be.eq.BN(tokenId1);
        });

      });
    });

  });

  describe('Under mint', async function () {

    const editionNumber3 = 300000;
    const editionData3 = web3.utils.asciiToHex("editionData3");
    const editionTokenUri3 = "edition3";
    const edition3Price = etherToWei(0.3);
    const minted = 2;
    const available = 4;

    beforeEach(async function () {
      await this.token.createActivePreMintedEdition(editionNumber3, editionData3, editionType, 0, 0, artistAccount, artistShare, edition3Price, editionTokenUri3, minted, available, {from: _owner});
    });

    it('under mint edition 3 is setup correctly', async function () {
      let edition = await this.token.detailsOfEdition(editionNumber3);

      bytesToString(edition[0]).should.be.equal("editionData3"); //_editionData
      edition[1].should.be.eq.BN(editionType); //_editionType
      edition[2].should.be.eq.BN(0); // _startDate
      edition[3].should.be.eq.BN(MAX_UINT32); // _endDate
      edition[4].should.be.equal(artistAccount); // _artistAccount
      edition[5].should.be.eq.BN(artistShare); // _artistCommission
      edition[6].should.be.eq.BN(edition3Price); // _priceInWei
      edition[7].should.be.equal(`${BASE_URI}${editionTokenUri3}`); // _tokenURI
      edition[8].should.be.eq.BN(minted); // _minted
      edition[9].should.be.eq.BN(available); // _available
      edition[10].should.be.equal(true); // _active
    });

    describe('edition 3 query methods', function () {
      it('editionsOfType', async function () {
        let editions = await this.token.editionsOfType(editionType);
        editions.map(e => e.toNumber()).should.be.deep.equal([editionNumber3]);
      });

      it('artistsEditions', async function () {
        let currentArtistEditions = await this.token.artistsEditions(artistAccount);
        currentArtistEditions.map(e => e.toNumber()).should.be.deep.equal([editionNumber3]);
      });

      it('purchaseDatesEdition', async function () {
        let dates = await this.token.purchaseDatesEdition(editionNumber3);
        dates[0].should.be.eq.BN(0);
        dates[1].should.be.eq.BN(MAX_UINT32);
      });

      it('priceInWeiEdition', async function () {
        let priceInWei = await this.token.priceInWeiEdition(editionNumber3);
        priceInWei.should.be.eq.BN(edition3Price);
      });

      it('tokensOfEdition', async function () {
        let tokensOfEdition = await this.token.tokensOfEdition(editionNumber3);
        tokensOfEdition.should.be.deep.equal([]);
      });

      it('editionActive', async function () {
        let editionActive = await this.token.editionActive(editionNumber3);
        editionActive.should.be.equal(true);
      });

      it('totalRemaining', async function () {
        let totalRemaining = await this.token.totalRemaining(editionNumber3);
        totalRemaining.should.be.eq.BN(available - minted);
      });

      it('totalSupplyEdition', async function () {
        let totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber3);
        totalSupplyEdition.should.be.eq.BN(minted);
      });

      it('totalAvailableEdition', async function () {
        let totalAvailableEdition = await this.token.totalAvailableEdition(editionNumber3);
        totalAvailableEdition.should.be.eq.BN(available);
      });

      it('tokenURIEdition', async function () {
        let tokenURIEdition = await this.token.tokenURIEdition(editionNumber3);
        tokenURIEdition.should.be.equal(`https://ipfs.infura.io/ipfs/${editionTokenUri3}`);
      });
    });

    it('should handle under mint and normal mints', async function () {
      const firstMinted = editionNumber3 + 3; // 300003
      const secondMinted = editionNumber3 + 4; // 300004
      const thirdMinted = editionNumber3 + 1;  // 300001
      const fourthMinted = editionNumber3 + 2;  // 300002

      let totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber3);
      totalSupplyEdition.should.be.eq.BN(minted);

      // Mint two more to make the edition sold out
      await this.token.purchase(editionNumber3, {from: account2, value: edition3Price});
      await this.token.purchase(editionNumber3, {from: account2, value: edition3Price});

      let tokensOf = await this.token.tokensOf(account2);
      tokensOf
        .map(e => e.toNumber())
        .should.be.deep.equal([firstMinted, secondMinted]);

      let totalRemaining = await this.token.totalRemaining(editionNumber3);
      totalRemaining.should.be.eq.BN(0);

      // Minted now at 4 as we mitned 2 more
      totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber3);
      totalSupplyEdition.should.be.eq.BN(minted + 2);

      // Reverts as sold out
      await assertRevert(this.token.purchase(editionNumber3, {from: account2}));

      // Attempt to under mint the original two editions
      await this.token.underMint(account2, editionNumber3, {from: _owner});

      // Make sure you can update mint the correct token ID
      let updatedTokenIds = await this.token.tokensOf(account2);
      updatedTokenIds
        .map(e => e.toNumber())
        .should.be.deep.equal([firstMinted, secondMinted, thirdMinted]);

      // Attempt to under mint the original two editions
      await this.token.underMint(account2, editionNumber3, {from: _owner});

      // Make sure you can update mint the correct token ID
      updatedTokenIds = await this.token.tokensOf(account2);
      updatedTokenIds
        .map(e => e.toNumber())
        .should.be.deep.equal([firstMinted, secondMinted, thirdMinted, fourthMinted]);

      // Check cannot mint any more as sold out
      await assertRevert(this.token.underMint(account2, editionNumber3, {from: _owner}));

      // Minted still at 4 as we have under-minted the remaining
      totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber3);
      totalSupplyEdition.should.be.eq.BN(minted + 2);
    });
  });

  describe('updateTotalSupply', async function () {

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
    });

    it('should allow updating minted number of editions', async function () {
      let totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber1);
      totalSupplyEdition.should.be.eq.BN(0);

      await this.token.updateTotalSupply(editionNumber1, 2, {from: _owner});

      totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber1);
      totalSupplyEdition.should.be.eq.BN(2);
    });

    it('should prevent updating minted number if tokens sold outways update', async function () {
      // Sell two
      await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
      await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});

      let totalSupplyEdition = await this.token.totalSupplyEdition(editionNumber1);
      totalSupplyEdition.should.be.eq.BN(2);

      // should fail when attempting to lower than this
      await assertRevert(this.token.updateTotalSupply(editionNumber1, 1, {from: _owner}));
    });

    it('should prevent updating minted if not KO', async function () {
      await assertRevert(this.token.updateTotalSupply(editionNumber1, 2, {from: account1}));
    });
  });

  describe('updateTotalAvailable', async function () {

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
    });

    it('should allow updating available number of editions', async function () {
      let totalAvailableEdition = await this.token.totalAvailableEdition(editionNumber1);
      totalAvailableEdition.should.be.eq.BN(3);

      await this.token.updateTotalAvailable(editionNumber1, 2, {from: _owner});

      totalAvailableEdition = await this.token.totalAvailableEdition(editionNumber1);
      totalAvailableEdition.should.be.eq.BN(2);
    });

    it('should reduce totalNumberAvailable when lowering edition config', async function () {
      let totalNumberAvailable = await this.token.totalNumberAvailable();
      totalNumberAvailable.should.be.eq.BN(3);

      await this.token.updateTotalAvailable(editionNumber1, 2, {from: _owner});

      let totalAvailableEdition = await this.token.totalAvailableEdition(editionNumber1);
      totalAvailableEdition.should.be.eq.BN(2);

      totalNumberAvailable = await this.token.totalNumberAvailable();
      totalNumberAvailable.should.be.eq.BN(2);
    });

    it('should prevent updating available number if tokens sold outways update', async function () {
      // Sell two
      await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
      await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});

      let totalAvailableEdition = await this.token.totalAvailableEdition(editionNumber1);
      totalAvailableEdition.should.be.eq.BN(3);

      // should fail when attempting to lower than this
      await assertRevert(this.token.updateTotalAvailable(editionNumber1, 1, {from: _owner}));
    });

    it('should prevent updating available if not KO', async function () {
      await assertRevert(this.token.updateTotalAvailable(editionNumber1, 2, {from: account1}));
    });
  });

  describe('totalNumberAvailable', async function () {

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
      await this.token.createActiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 4, {from: _owner});
    });

    it('should marry up to the number defined in the edition confi', async function () {
      let totalNumberAvailable = await this.token.totalNumberAvailable();
      totalNumberAvailable.should.be.eq.BN(3 + 4);
    });
  });

  describe('burn', async function () {

    describe('validation', async function () {
      const unknownTokenId = 9999;
      const tokenId = editionNumber1 + 1;

      beforeEach(async function () {
        // Create edition
        await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});

        // Create token
        await this.token.purchase(editionNumber1, {from: account3, value: edition1Price});

        // Confirm the token is owned by the purchaser
        let tokensOf = await this.token.tokensOf(account3);
        tokensOf.map(e => e.toNumber()).should.be.deep.equal([tokenId]);
      });

      it('cant burn a token which does not exist', async function () {
        await assertRevert(this.token.burn(unknownTokenId, {from: _owner}));
      });

      it('cant burn a token which is already burnt', async function () {
        await this.token.burn(tokenId, {from: _owner});
        await assertRevert(this.token.burn(tokenId, {from: _owner}));
      });

      it('cant burn a token when not KO', async function () {
        await assertRevert(this.token.burn(tokenId, {from: account1}));
      });

      it('can burn token if you are the owner', async function () {
        await this.token.burn(tokenId, {from: _owner});
      });
    });

    describe('once minted', async function () {

      const edition1Available = 3;

      const edition2Minted = 2;
      const edition2Available = 4;
      const editionType2 = 2;

      const _100001 = editionNumber1 + 1;
      const _100002 = editionNumber1 + 2;

      const _200001 = editionNumber2 + 1; // under minted
      const _200002 = editionNumber2 + 2;
      const _200003 = editionNumber2 + 3;
      const _200004 = editionNumber2 + 4;

      beforeEach(async function () {
        // Create normal edition with no pre-minted (type 1)
        await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, edition1Available, {from: _owner});

        // Create pre-minted edition (type 2)
        await this.token.createActivePreMintedEdition(editionNumber2, editionData2, editionType2, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, edition2Minted, edition2Available, {from: _owner});
      });

      beforeEach(async function () {
        // Mint token - account 3
        await this.token.purchase(editionNumber1, {from: account3, value: edition1Price});
        let tokensOf = await this.token.tokensOf(account3);
        tokensOf.map(e => e.toNumber()).should.be.deep.equal([_100001]);

        // Mint token - account 1
        await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
        tokensOf = await this.token.tokensOf(account1);
        tokensOf.map(e => e.toNumber()).should.be.deep.equal([_100002]);

        // Mint token - account 2
        await this.token.purchase(editionNumber2, {from: account2, value: edition2Price});
        tokensOf = await this.token.tokensOf(account2);
        tokensOf.map(e => e.toNumber()).should.be.deep.equal([_200003]);

        // Mint token - account 3
        await this.token.underMint(account3, editionNumber2, {from: _owner});
        tokensOf = await this.token.tokensOf(account3);
        tokensOf.map(e => e.toNumber()).should.be.deep.equal([_100001, _200001]);
      });

      describe('once burnt', async function () {

        beforeEach(async function () {
          // Burn two of the created tokens
          await this.token.burn(_100002, {from: _owner});
          await this.token.burn(_200001, {from: _owner});
        });

        it('tokensOfEdition leaves zero in place of burnt token', async function () {
          let tokensOfEdition = await this.token.tokensOfEdition(editionNumber1);
          tokensOfEdition.map(e => e.toNumber()).should.be.deep.equal([_100001, 0]);

          tokensOfEdition = await this.token.tokensOfEdition(editionNumber2);
          tokensOfEdition.map(e => e.toNumber()).should.be.deep.equal([_200003, 0]);
        });

        it('editionOfTokenId returns zero once burnt', async function () {
          let editionOfTokenId = await this.token.editionOfTokenId(_100002);
          editionOfTokenId.should.be.eq.BN(0);

          editionOfTokenId = await this.token.editionOfTokenId(_200001);
          editionOfTokenId.should.be.eq.BN(0);
        });

        it('totalNumberAvailable remains the same', async function () {
          let totalNumberAvailable = await this.token.totalNumberAvailable();
          totalNumberAvailable.should.be.eq.BN(edition1Available + edition2Available);
        });

        it('totalNumberMinted remains the same', async function () {
          let totalNumberMinted = await this.token.totalNumberMinted();
          totalNumberMinted.should.be.eq.BN(edition2Minted + 2); // + 2 as we minted 2 from edition 1
        });

        it('tokenURI throws as required by the spec', async function () {
          await assertRevert(this.token.tokenURI(_100002));
        });

        it('tokenURISafe returns only the base when token burnt', async function () {
          let tokenURISafe = await this.token.tokenURISafe(_100002);
          tokenURISafe.should.be.equal(BASE_URI);
        });

        it('edition 1 - totalAvailableEdition remains the same after burnt', async function () {
          let editionNumber1Available = await this.token.totalAvailableEdition(editionNumber1);
          editionNumber1Available.should.be.eq.BN(edition1Available);
        });

        it('edition 2 - totalAvailableEdition remains the same after burnt', async function () {
          let editionNumber2Available = await this.token.totalAvailableEdition(editionNumber2);
          editionNumber2Available.should.be.eq.BN(edition2Available);
        });

        it('edition 1 - totalSupplyEdition remains the same after burnt', async function () {
          let editionNumber1TotalSupply = await this.token.totalSupplyEdition(editionNumber1);
          editionNumber1TotalSupply.should.be.eq.BN(2); // 2 tokens sold from edition 1
        });

        it('edition 2 - totalSupplyEdition remains the same after burnt', async function () {
          let editionNumber2TotalSupply = await this.token.totalSupplyEdition(editionNumber2);
          editionNumber2TotalSupply.should.be.eq.BN(edition2Minted + 1); // 1 under mint + 1 normal mint
        });

        it('edition 1 - totalRemaining remains the same after burnt', async function () {
          let editionNumber1Remaining = await this.token.totalRemaining(editionNumber1);
          editionNumber1Remaining.should.be.eq.BN(edition1Available - 2); // 2 tokens sold from edition 1
        });

        it('edition 2 - totalRemaining remains the same after burnt', async function () {
          let editionNumber2Remaining = await this.token.totalRemaining(editionNumber2);
          editionNumber2Remaining.should.be.eq.BN(edition2Available - edition2Minted - 1); // 1 under mint + 1 normal mint
        });

        it('edition 1 setup remains correct', async function () {
          let edition = await this.token.detailsOfEdition(editionNumber1);

          bytesToString(edition[0]).should.be.equal("editionData1"); //_editionData
          edition[1].should.be.eq.BN(editionType); //_editionType
          edition[2].should.be.eq.BN(0); // _startDate
          edition[3].should.be.eq.BN(MAX_UINT32); // _endDate
          edition[4].should.be.equal(artistAccount); // _artistAccount
          edition[5].should.be.eq.BN(artistShare); // _artistCommission
          edition[6].should.be.eq.BN(edition1Price); // _priceInWei
          edition[7].should.be.equal(`${BASE_URI}${editionTokenUri1}`); // _tokenURI
          edition[8].should.be.eq.BN(2); // _minted
          edition[9].should.be.eq.BN(edition1Available); // _available
          edition[10].should.be.equal(true); // _active
        });

        it(`tokenData reverts when burnt`, async function () {
          [_200001, _100002].forEach(async function (token) {
            await assertRevert(this.token.tokenData(token));
          });
        });

        it(`tokenData reverts when burnt`, async function () {
          [_200001, _100002].forEach(async function (token) {
            await assertRevert(this.token.tokenData(token));
          });
        });

        it('purchaseDatesToken is cleared when burnt', async function () {
          [_200001, _100002].forEach(async function (token) {
            let result1 = await this.token.purchaseDatesToken(token);
            result1.map(e => e.toNumber())
              .should.be.deep.equal([0, 0]);
          });
        });

        it('priceInWeiToken is cleared when burnt', async function () {
          [_200001, _100002].forEach(async function (token) {
            let result1 = await this.token.priceInWeiToken(token);
            result1.should.be.eq.BN(0);
          });
        });

        it('setTokenURI cant be changed once burnt', async function () {
          await assertRevert(this.token.setTokenURI(_200001, "123", {from: _owner}));
        });

      });

      describe('once burnt - undermint should re-populate burnt token ID', async function () {

        beforeEach(async function () {
          // Burn a token from edition 2 (under-mint edition)
          await this.token.burn(_200001, {from: _owner});

          let tokensOfEdition = await this.token.tokensOfEdition(editionNumber2);
          tokensOfEdition.map(e => e.toNumber()).should.be.deep.equal([_200003, 0]);
        });

        it('should be able to mint more tokens once burnt', async function () {

          // mint the last three remaining tokens
          await this.token.mint(account3, editionNumber2, {from: _owner});
          await this.token.underMint(account3, editionNumber2, {from: _owner});
          await this.token.underMint(account3, editionNumber2, {from: _owner});

          // 200001 is re-minted, 200002 created
          let tokensOfEdition = await this.token.tokensOfEdition(editionNumber2);
          tokensOfEdition.map(e => e.toNumber()).should.be.deep.equal([_200003, 0, _200004, _200001, _200002]);

          // Check you cannot mint/undermint any more
          await assertRevert(this.token.mint(account3, editionNumber2, {from: _owner}));
          await assertRevert(this.token.underMint(account3, editionNumber2, {from: _owner}));

          // Check you cannot purchase
          await assertRevert(this.token.purchase(editionNumber2, {from: account1, value: edition2Price}));
          await assertRevert(this.token.purchaseTo(account1, editionNumber2, {from: account2, value: edition2Price}));
        });

      });

      describe('once burnt - purchasing the remaining tokens will re-mint burnt token ID', async function () {

        beforeEach(async function () {
          // Burn a token from edition 2 (under-mint edition)
          await this.token.burn(_200001, {from: _owner});

          let tokensOfEdition = await this.token.tokensOfEdition(editionNumber2);
          tokensOfEdition.map(e => e.toNumber()).should.be.deep.equal([_200003, 0]);
        });

        it('should be able to mint more tokens once burnt', async function () {

          // purchase the remaining token
          await this.token.purchase(editionNumber2, {from: account1, value: edition2Price});

          // 200001 is re-minted
          let tokensOfEdition = await this.token.tokensOfEdition(editionNumber2);
          tokensOfEdition.map(e => e.toNumber()).should.be.deep.equal([_200003, 0, _200004]);

          // Check you cannot purchase/mint
          await assertRevert(this.token.purchase(editionNumber2, {from: account1, value: edition2Price}));
          await assertRevert(this.token.purchaseTo(account1, editionNumber2, {from: account2, value: edition2Price}));
          await assertRevert(this.token.mint(account3, editionNumber2, {from: _owner}));

          // However you can under mint the missing tokens
          await this.token.underMint(account3, editionNumber2, {from: _owner});
          await this.token.underMint(account3, editionNumber2, {from: _owner});

          // 200001 is re-minted, 200002 is newly created
          tokensOfEdition = await this.token.tokensOfEdition(editionNumber2);
          tokensOfEdition.map(e => e.toNumber()).should.be.deep.equal([_200003, 0, _200004, _200001, _200002]);

          // Confirm once reach max number available, dont mint anymore
          await assertRevert(this.token.underMint(account3, editionNumber2, {from: _owner}));
        });

      });

    });

    // TODO tests for token swap after a burn
  });

  describe('batchTransfer', async function () {

    const _100001 = editionNumber1 + 1;
    const _100002 = editionNumber1 + 2;
    const _100003 = editionNumber1 + 3;

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});

      // Account2 owns first 2 tokens
      await this.token.purchase(editionNumber1, {from: account2, value: edition1Price});
      await this.token.purchase(editionNumber1, {from: account2, value: edition1Price});

      // Account3 owns the last one
      await this.token.purchase(editionNumber1, {from: account3, value: edition1Price});
    });

    it('should transfer all tokens defined', async function () {
      let tokensOf = await this.token.tokensOf(account2);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([_100001, _100002]);

      await this.token.batchTransfer(account4, [_100001, _100002], {from: account2});

      // Check account 2 no longer owns them
      tokensOf = await this.token.tokensOf(account2);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([]);

      // Check account 4 now owns them
      tokensOf = await this.token.tokensOf(account4);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([_100001, _100002]);
    });

    it('should fail if one of the tokens is not owner by the caller', async function () {
      await assertRevert(this.token.batchTransfer(account4, [_100001, _100003], {from: account2}));

      // confirm account2 still owns both
      let tokensOf = await this.token.tokensOf(account2);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([_100001, _100002]);

      // Check account 4 does not own any
      tokensOf = await this.token.tokensOf(account4);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([]);
    });

    it('should allow transfer to someone from approved account even if they dont own them', async function () {
      // Fails
      await assertRevert(this.token.batchTransfer(account4, [_100001, _100002], {from: account3}));

      // Approve account 3 to move them
      await this.token.setApprovalForAll(account3, true, {from: account2});

      // Try again
      await this.token.batchTransfer(account4, [_100001, _100002], {from: account3});

      // Check account 2 no longer owns them
      let tokensOf = await this.token.tokensOf(account2);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([]);

      // Check account 4 now owns them
      tokensOf = await this.token.tokensOf(account4);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([_100001, _100002]);
    });

  });

  describe('batchTransferFrom', async function () {

    const _100001 = editionNumber1 + 1;
    const _100002 = editionNumber1 + 2;
    const _100003 = editionNumber1 + 3;

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});

      // Account2 owns first 2 tokens
      await this.token.purchase(editionNumber1, {from: account2, value: edition1Price});
      await this.token.purchase(editionNumber1, {from: account2, value: edition1Price});

      // Account3 owns the last one
      await this.token.purchase(editionNumber1, {from: account3, value: edition1Price});
    });

    it('should transfer all tokens defined', async function () {
      let tokensOf = await this.token.tokensOf(account2);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([_100001, _100002]);

      await this.token.batchTransferFrom(account2, account4, [_100001, _100002], {from: account2});

      // Check account 2 no longer owns them
      tokensOf = await this.token.tokensOf(account2);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([]);

      // Check account 4 now owns them
      tokensOf = await this.token.tokensOf(account4);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([_100001, _100002]);
    });

    it('should fail if one of the tokens is not owner by the caller', async function () {
      await assertRevert(this.token.batchTransferFrom(account2, account4, [_100001, _100003], {from: account2}));

      // confirm account2 still owns both
      let tokensOf = await this.token.tokensOf(account2);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([_100001, _100002]);

      // Check account 4 does not own any
      tokensOf = await this.token.tokensOf(account4);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([]);
    });

    it('should allow transfer to someone from approved account even if they dont own them', async function () {
      // Fails
      await assertRevert(this.token.batchTransferFrom(account2, account4, [_100001, _100002], {from: account3}));

      // Approve account 3 to move them
      await this.token.setApprovalForAll(account3, true, {from: account2});

      // Try again
      await this.token.batchTransferFrom(account2, account4, [_100001, _100002], {from: account3});

      // Check account 2 no longer owns them
      let tokensOf = await this.token.tokensOf(account2);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([]);

      // Check account 4 now owns them
      tokensOf = await this.token.tokensOf(account4);
      tokensOf.map(e => e.toNumber())
        .should.be.deep.equal([_100001, _100002]);
    });

  });

  describe('access control', async function () {

    beforeEach(async function () {
      await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
    });

    describe('minting editions', async function () {
      it('unable to mint() when not part of ROLE_MINTER', async function () {
        await assertRevert(this.token.mint(account3, editionNumber1, {from: account1}));
      });

      it('can successfully call mint() when part of ROLE_MINTER', async function () {
        let tokens = await this.token.tokensOf(account3);
        tokens.map(e => e.toNumber()).should.be.deep.equal([]);

        await assertRevert(this.token.mint(account3, editionNumber1, {from: account1}));

        await this.token.addAddressToAccessControl(account1, ROLE_MINTER, {from: _owner});

        await this.token.mint(account3, editionNumber1, {from: account1});

        tokens = await this.token.tokensOf(account3);
        tokens.map(e => e.toNumber()).should.be.deep.equal([editionNumber1 + 1]);
      });
    });

    describe('under minting editions', async function () {
      it('unable to underMint() when not part of ROLE_UNDER_MINTER', async function () {
        await assertRevert(this.token.underMint(account3, editionNumber1, {from: account1}));
      });

      it('can successfully call underMint() when part of ROLE_UNDER_MINTER', async function () {
        let tokens = await this.token.tokensOf(account3);
        tokens.map(e => e.toNumber()).should.be.deep.equal([]);

        await assertRevert(this.token.underMint(account3, editionNumber1, {from: account1}));

        await this.token.addAddressToAccessControl(account1, ROLE_UNDER_MINTER, {from: _owner});

        await this.token.underMint(account3, editionNumber1, {from: account1});

        tokens = await this.token.tokensOf(account3);
        tokens.map(e => e.toNumber()).should.be.deep.equal([editionNumber1 + 1]);
      });
    });

    describe('createActiveEdition()', async function () {
      it('unable to createActiveEdition() when not part of ROLE_KNOWN_ORIGIN', async function () {
        await assertRevert(this.token.createActiveEdition(editionNumber2, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: account1}));
        let exists = await this.token.editionExists(editionNumber2);
        exists.should.be.equal(false);
      });

      it('can successfully call createActiveEdition() when part of ROLE_KNOWN_ORIGIN', async function () {
        await this.token.addAddressToAccessControl(account1, ROLE_KNOWN_ORIGIN, {from: _owner});

        await this.token.createActiveEdition(editionNumber2, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: account1});

        let exists = await this.token.editionExists(editionNumber2);
        exists.should.be.equal(true);
      });
    });

    describe('createInactiveEdition()', async function () {
      it('unable to createInactiveEdition() when not part of ROLE_KNOWN_ORIGIN', async function () {
        await assertRevert(this.token.createInactiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 1, {from: account1}));
        let exists = await this.token.editionExists(editionNumber2);
        exists.should.be.equal(false);
      });

      it('can successfully call createInactiveEdition() when part of ROLE_KNOWN_ORIGIN', async function () {
        await this.token.addAddressToAccessControl(account1, ROLE_KNOWN_ORIGIN, {from: _owner});

        await this.token.createInactiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 1, {from: account1});

        let exists = await this.token.editionExists(editionNumber2);
        exists.should.be.equal(true);
      });
    });

    describe('createActivePreMintedEdition()', async function () {
      it('unable to createActivePreMintedEdition() when not part of ROLE_KNOWN_ORIGIN', async function () {
        await assertRevert(this.token.createActivePreMintedEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 2, 4, {from: account1}));
        let exists = await this.token.editionExists(editionNumber2);
        exists.should.be.equal(false);
      });

      it('can successfully call createActivePreMintedEdition() when part of ROLE_KNOWN_ORIGIN', async function () {
        await this.token.addAddressToAccessControl(account1, ROLE_KNOWN_ORIGIN, {from: _owner});

        this.token.createActivePreMintedEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 2, 5, {from: account1});

        let exists = await this.token.editionExists(editionNumber2);
        exists.should.be.equal(true);
      });
    });

    describe('createInactivePreMintedEdition()', async function () {
      it('unable to createInactivePreMintedEdition() when not part of ROLE_KNOWN_ORIGIN', async function () {
        await assertRevert(this.token.createInactivePreMintedEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 2, 4, {from: account1}));
        let exists = await this.token.editionExists(editionNumber2);
        exists.should.be.equal(false);
      });

      it('can successfully call createInactivePreMintedEdition() when part of ROLE_KNOWN_ORIGIN', async function () {
        await this.token.addAddressToAccessControl(account1, ROLE_KNOWN_ORIGIN, {from: _owner});

        this.token.createInactivePreMintedEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 2, 4, {from: account1});

        let exists = await this.token.editionExists(editionNumber2);
        exists.should.be.equal(true);
      });
    });

  });

});
