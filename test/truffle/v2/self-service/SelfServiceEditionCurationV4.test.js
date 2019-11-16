const assertRevert = require('../../../helpers/assertRevert');
const etherToWei = require('../../../helpers/etherToWei');
const _ = require('lodash');
const bnChai = require('bn-chai');

const getBalance = require('../../../helpers/getBalance');
const toBN = require('../../../helpers/toBN');
const {duration, increaseTo, advanceBlock, latest} = require('../../../helpers/time');

const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const SelfServiceEditionCurationV4 = artifacts.require('SelfServiceEditionCurationV4');
const SelfServiceAccessControls = artifacts.require('SelfServiceAccessControls');
const SelfServiceFrequencyControls = artifacts.require('SelfServiceFrequencyControls');

const ArtistAcceptingBidsV2 = artifacts.require('ArtistAcceptingBidsV2');

require('chai')
  .use(require('chai-as-promised'))
  .use(bnChai(web3.utils.BN))
  .should();

contract.skip('SelfServiceEditionCurationV4 tests', function (accounts) {

  const ROLE_KNOWN_ORIGIN = 1;
  const MAX_UINT32 = 4294967295;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const _owner = accounts[0];
  const koCommission = accounts[1];

  const editionType = 1;
  const editionData = web3.utils.asciiToHex('editionData');
  const edition1Price = etherToWei(0.1);

  const artistCommission = 76;

  const edition1 = {
    number: 10000,
    artist: accounts[2],
    tokenUri: 'edition1',
    total: 100
  };

  const edition2 = {
    number: 20000,
    artist: accounts[3],
    tokenUri: 'edition2',
    total: 100
  };

  beforeEach(async () => {
    // Create KODA
    this.koda = await KnownOriginDigitalAssetV2.new({from: _owner});

    // Create Auction
    this.auction = await ArtistAcceptingBidsV2.new(this.koda.address, {from: _owner});

    // Create Self Service Access controls
    this.accessControls = await SelfServiceAccessControls.new({from: _owner});

    // Create Self Service Access controls
    this.frequencyControls = await SelfServiceFrequencyControls.new({from: _owner});

    // Create Minter
    this.minter = await SelfServiceEditionCurationV4.new(
      this.koda.address,
      this.auction.address,
      this.accessControls.address,
      this.frequencyControls.address,
      {from: _owner}
    );

    // Whitelist the minting contract
    await this.koda.addAddressToAccessControl(this.minter.address, ROLE_KNOWN_ORIGIN, {from: _owner});

    // Whitelist the self service contract
    await this.auction.addAddressToWhitelist(this.minter.address, {from: _owner});

    this.freezeWindow = await this.minter.freezeWindow();
  });

  beforeEach(async () => {
    // Create 2 editions in KODA already
    await this.koda.createActiveEdition(edition1.number, editionData, editionType, 0, 0, edition1.artist, artistCommission, edition1Price, edition1.tokenUri, edition1.total, {from: _owner});
    await this.koda.createActiveEdition(edition2.number, editionData, editionType, 0, 0, edition2.artist, artistCommission, edition1Price, edition2.tokenUri, edition2.total, {from: _owner});
  });

  describe('creating new editions', async () => {

    describe('failing validation', async () => {

      beforeEach(async () => {
        await this.accessControls.setOpenToAllArtist(true, {from: _owner});
      });

      it('should fail when creating editions larger than 100', async () => {
        await assertRevert(
          this.minter.createEdition(101, etherToWei(1), 0, '123', false, {from: edition2.artist}),
          'Must not exceed max edition size'
        );
      });

      it('should fail when creating editions of size of zero', async () => {
        await assertRevert(
          this.minter.createEdition(0, etherToWei(1), 0, '123', false, {from: edition2.artist}),
          'Must be at least one available in edition'
        );
      });

      it('should fail when token URI not defined', async () => {
        await assertRevert(
          this.minter.createEdition(100, etherToWei(1), 0, '', false, {from: edition2.artist}),
          'Token URI is missing'
        );
      });

      it('should fail if artist not on the KO platform and minter IS open to all', async () => {
        await assertRevert(
          this.minter.createEdition(100, etherToWei(1), 0, '232323', false, {from: koCommission}),
          'Can only mint your own once we have enabled you on the platform'
        );
      });
    });

    describe('success without enabling auctions', async () => {

      describe('when enabled for all artists', async () => {

        beforeEach(async () => {
          // enable for all artists on the platform
          await this.accessControls.setOpenToAllArtist(true, {from: _owner});
        });

        it('unknown artists should NOT be able to create edition', async () => {
          const edition3 = {
            total: 10,
            tokenUri: 'ipfs://edition3',
            price: etherToWei(1)
          };
          await assertRevert(
            this.minter.createEdition(edition3.total, edition3.price, 0, edition3.tokenUri, false, {from: accounts[6]}),
            'Can only mint your own once we have enabled you on the platform'
          );
        });

      });

      describe('when enabled for selected artists', async () => {
        beforeEach(async () => {
          await this.accessControls.setOpenToAllArtist(false, {from: _owner});

          // enable only for edition1.artist
          await this.accessControls.setAllowedArtist(edition1.artist, true, {from: _owner});
        });

        it('artist 1 should be not able to create multiple editions without waiting', async () => {
          const edition3 = {
            total: 10,
            tokenUri: 'ipfs://edition3',
            price: etherToWei(1)
          };

          const {logs: edition1Logs} = await this.minter.createEdition(edition3.total, edition3.price, 0, edition3.tokenUri, false, {from: edition1.artist});
          edition1Logs[0].event.should.be.equal('SelfServiceEditionCreated');
          edition1Logs[0].args._editionNumber.should.be.eq.BN(20200); // last edition no. is 20000 and has total of 100 in it
          edition1Logs[0].args._creator.should.be.equal(edition1.artist); // artist from edition 1 created it
          edition1Logs[0].args._priceInWei.should.be.eq.BN(edition3.price);
          edition1Logs[0].args._totalAvailable.should.be.eq.BN(edition3.total);

          const edition4 = {
            total: 50,
            tokenUri: 'ipfs://edition4',
            price: etherToWei(2)
          };

          await assertRevert(
            this.minter.createEdition(edition4.total, edition4.price, 0, edition4.tokenUri, false, {from: edition1.artist}),
            'Sender currently frozen out of creation'
          );
        });

        it('artist 1 should be not able to create multiple editions without waiting less than window', async () => {
          const edition3 = {
            total: 10,
            tokenUri: 'ipfs://edition3',
            price: etherToWei(1)
          };

          const {logs: edition1Logs} = await this.minter.createEdition(edition3.total, edition3.price, 0, edition3.tokenUri, false, {from: edition1.artist});
          edition1Logs[0].event.should.be.equal('SelfServiceEditionCreated');
          edition1Logs[0].args._editionNumber.should.be.eq.BN(20200); // last edition no. is 20000 and has total of 100 in it
          edition1Logs[0].args._creator.should.be.equal(edition1.artist); // artist from edition 1 created it
          edition1Logs[0].args._priceInWei.should.be.eq.BN(edition3.price);
          edition1Logs[0].args._totalAvailable.should.be.eq.BN(edition3.total);

          const canCreateAnotherEdition = await this.minter.canCreateAnotherEdition(edition1.artist);
          canCreateAnotherEdition.should.be.equal(false);

          const oneWindowMinusOne = toBN((await latest())).add(this.freezeWindow.sub(toBN('1')));
          await increaseTo(oneWindowMinusOne);

          const edition4 = {
            total: 50,
            tokenUri: 'ipfs://edition4',
            price: etherToWei(2)
          };

          await assertRevert(
            this.minter.createEdition(edition4.total, edition4.price, 0, edition4.tokenUri, false, {from: edition1.artist}),
            'Sender currently frozen out of creation'
          );
        });

        it('artist 1 should be able to create multiple editions if they wait for new window', async () => {
          const edition3 = {
            total: 10,
            tokenUri: 'ipfs://edition3',
            price: etherToWei(1)
          };

          const {logs: edition1Logs} = await this.minter.createEdition(edition3.total, edition3.price, 0, edition3.tokenUri, false, {from: edition1.artist});
          edition1Logs[0].event.should.be.equal('SelfServiceEditionCreated');
          edition1Logs[0].args._editionNumber.should.be.eq.BN(20200); // last edition no. is 20000 and has total of 100 in it
          edition1Logs[0].args._creator.should.be.equal(edition1.artist); // artist from edition 1 created it
          edition1Logs[0].args._priceInWei.should.be.eq.BN(edition3.price);
          edition1Logs[0].args._totalAvailable.should.be.eq.BN(edition3.total);

          const canCreateAnotherEdition = await this.minter.canCreateAnotherEdition(edition1.artist);
          canCreateAnotherEdition.should.be.equal(false);

          const oneWindow = toBN((await latest())).add(this.freezeWindow);
          await increaseTo(oneWindow);

          const canCreateAnotherEditionAfter = await this.minter.canCreateAnotherEdition(edition1.artist);
          canCreateAnotherEditionAfter.should.be.equal(true);

          const edition4 = {
            total: 50,
            tokenUri: 'ipfs://edition4',
            price: etherToWei(2)
          };
          const {logs: edition2Logs} = await this.minter.createEdition(edition4.total, edition4.price, 0, edition4.tokenUri, false, {from: edition1.artist});

          edition2Logs[0].event.should.be.equal('SelfServiceEditionCreated');
          edition2Logs[0].args._editionNumber.should.be.eq.BN(20300); // last edition no. is 20200 and has total of 10 in it = 20210 - rounded up to nearest 100 = 20300
          edition2Logs[0].args._creator.should.be.equal(edition1.artist); // artist from edition 1 created it
          edition2Logs[0].args._priceInWei.should.be.eq.BN(edition4.price);
          edition2Logs[0].args._totalAvailable.should.be.eq.BN(edition4.total);
        });

        it('artist 2 should NOT be able to create edition', async () => {
          const edition3 = {
            total: 10,
            tokenUri: 'ipfs://edition3',
            price: etherToWei(1)
          };
          await assertRevert(
            this.minter.createEdition(edition3.total, edition3.price, 0, edition3.tokenUri, false, {from: edition2.artist}),
            'Only allowed artists can create editions for now'
          );
        });
      });

    });

    describe('success an enabling auctions', async () => {

      beforeEach(async () => {
        await this.accessControls.setOpenToAllArtist(true, {from: _owner});
      });

      it('can mint new edition and enables auction', async () => {
        const edition3 = {
          total: 10,
          tokenUri: 'ipfs://edition3',
          price: etherToWei(1)
        };

        const creator = edition1.artist;
        const expectedEditionNumber = 20200;

        // Check logs from creation call
        const {logs} = await this.minter.createEdition(edition3.total, edition3.price, 0, edition3.tokenUri, true, {from: creator});
        logs[0].event.should.be.equal('SelfServiceEditionCreated');
        logs[0].args._editionNumber.should.be.eq.BN(expectedEditionNumber); // last edition no. is 20000 and has total of 100 in it
        logs[0].args._creator.should.be.equal(creator); // artist from edition 1 created it
        logs[0].args._priceInWei.should.be.eq.BN(edition3.price);
        logs[0].args._totalAvailable.should.be.eq.BN(edition3.total);

        // Check edition created in KODA
        const edition = await this.koda.detailsOfEdition(expectedEditionNumber);
        edition[1].should.be.eq.BN(1);
        edition[2].should.be.eq.BN(0);
        edition[3].should.be.eq.BN(MAX_UINT32);
        edition[4].should.be.equal(creator);
        edition[5].should.be.eq.BN(85); // reduced commission for KO with self service?
        edition[6].should.be.eq.BN(edition3.price);
        edition[7].should.be.equal(`https://ipfs.infura.io/ipfs/${edition3.tokenUri}`);
        edition[8].should.be.eq.BN(0);
        edition[9].should.be.eq.BN(edition3.total);
        edition[10].should.be.equal(true);

        // check auction details
        const {_enabled, _bidder, _value, _controller} = await this.auction.auctionDetails(expectedEditionNumber);
        _enabled.should.be.equal(true);
        _bidder.should.be.equal(ZERO_ADDRESS);
        _value.should.be.eq.BN(0);
        _controller.should.be.equal(creator);
      });

    });

    describe('creating several editions for an artist in a row', async () => {

      beforeEach(async () => {
        await this.accessControls.setOpenToAllArtist(true, {from: _owner});
      });

      it('successful creates all the right editions', async () => {
        const {logs: edition1} = await this.minter.createEditionFor(accounts[2], 17, etherToWei(1), 0, '111-111-111', true, {from: _owner});
        validateEditionCreatedLog(edition1, {
          _editionNumber: 20200,
          _creator: accounts[2],
          _priceInWei: etherToWei(1),
          _totalAvailable: 17
        });

        const {logs: edition2} = await this.minter.createEditionFor(accounts[3], 99, etherToWei(2), 0, '222-222-222', true, {from: _owner});
        validateEditionCreatedLog(edition2, {
          _editionNumber: 20300,
          _creator: accounts[3],
          _priceInWei: etherToWei(2),
          _totalAvailable: 99
        });

        const {logs: edition3} = await this.minter.createEditionFor(accounts[4], 1, etherToWei(3), 0, '333-333-333', true, {from: _owner});
        validateEditionCreatedLog(edition3, {
          _editionNumber: 20400,
          _creator: accounts[4],
          _priceInWei: etherToWei(3),
          _totalAvailable: 1
        });

        const {logs: edition4} = await this.minter.createEditionFor(accounts[5], 34, etherToWei(4), 0, '444-444-444', true, {from: _owner});
        validateEditionCreatedLog(edition4, {
          _editionNumber: 20500,
          _creator: accounts[5],
          _priceInWei: etherToWei(4),
          _totalAvailable: 34
        });

        const {logs: edition5} = await this.minter.createEditionFor(accounts[5], 100, etherToWei(5), 0, '555-555-555', true, {from: _owner});
        validateEditionCreatedLog(edition5, {
          _editionNumber: 20600,
          _creator: accounts[5],
          _priceInWei: etherToWei(5),
          _totalAvailable: 100
        });

        const {logs: edition6} = await this.minter.createEditionFor(accounts[6], 100, etherToWei(5), 0, '666-666-666', true, {from: _owner});
        validateEditionCreatedLog(edition6, {
          _editionNumber: 20800,
          _creator: accounts[6],
          _priceInWei: etherToWei(5),
          _totalAvailable: 100
        });

        // spills over to the next 1000
        const {logs: edition7} = await this.minter.createEditionFor(accounts[7], 100, etherToWei(6), 0, '777-777-777', true, {from: _owner});
        validateEditionCreatedLog(edition7, {
          _editionNumber: 21000,
          _creator: accounts[7],
          _priceInWei: etherToWei(6),
          _totalAvailable: 100
        });
      });

      function validateEditionCreatedLog(logs, {_editionNumber, _creator, _priceInWei, _totalAvailable}) {
        logs[0].event.should.be.equal('SelfServiceEditionCreated');
        logs[0].args._editionNumber.should.be.eq.BN(_editionNumber);
        logs[0].args._creator.should.be.equal(_creator);
        logs[0].args._priceInWei.should.be.eq.BN(_priceInWei);
        logs[0].args._totalAvailable.should.be.eq.BN(_totalAvailable);
      }

    });
  });

  describe('price restrictions', async () => {

    beforeEach(async () => {
      await this.accessControls.setOpenToAllArtist(true, {from: _owner});
      await this.minter.setMinPricePerEdition(etherToWei(1), {from: _owner});
    });

    it('min price should be set', async () => {
      const minPricePerEdition = await this.minter.minPricePerEdition();
      minPricePerEdition.should.be.eq.BN(etherToWei(1));
    });

    it('should fail minting when price less than 1 ETH', async () => {
      await assertRevert(
        this.minter.createEdition(10, etherToWei(9.99), 0, 'tokenUri', false, {from: edition1.artist}),
        'Price must be greater than minimum'
      );
    });

    it('should success minting when price is 1 ETH', async () => {
      await this.minter.createEdition(10, etherToWei(1), 0, 'tokenUri', false, {from: edition1.artist});
    });

    it('should success minting when price is greater than 1 ETH', async () => {
      await this.minter.createEdition(10, etherToWei(1.1), 0, 'tokenUri', false, {from: edition1.artist});
    });
  });
});
