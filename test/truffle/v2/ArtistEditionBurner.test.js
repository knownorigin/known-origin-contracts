const assertRevert = require('../../helpers/assertRevert');
const etherToWei = require('../../helpers/etherToWei');
const bnChai = require('bn-chai');

const _ = require('lodash');

const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const ArtistEditionBurner = artifacts.require('ArtistEditionBurner');

require('chai')
  .use(require('chai-as-promised'))
  .use(bnChai(web3.utils.BN))
  .should();

contract.only('ArtistEditionBurner', function (accounts) {

  const ROLE_KNOWN_ORIGIN = 1;

  const _owner = accounts[0];

  const account2 = accounts[2];

  const artistAccount = accounts[8];
  const artistShare = 85;

  const editionType = 1;

  const editionNumber1 = 100000;
  const editionData1 = web3.utils.asciiToHex('editionData1');
  const editionTokenUri1 = 'edition1';
  const edition1Price = etherToWei(0.1);

  const editionNumber2 = 200000;
  const editionData2 = web3.utils.asciiToHex('editionData2');
  const editionTokenUri2 = 'edition2';
  const edition2Price = etherToWei(0.2);

  beforeEach(async () => {
    this.koda = await KnownOriginDigitalAssetV2.new({from: _owner});
    this.burner = await ArtistEditionBurner.new(this.koda.address, {from: _owner});

    // Whitelist the burner contract
    await this.koda.addAddressToAccessControl(this.burner.address, ROLE_KNOWN_ORIGIN, {from: _owner});
  });

  describe('Can disable unsold editions', async () => {

    beforeEach(async () => {
      await this.koda.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
    });

    it('editionActive', async () => {
      let editionActive = await this.koda.editionActive(editionNumber1);
      editionActive.should.be.equal(true);
    });

    it('totalRemaining', async () => {
      let totalRemaining = await this.koda.totalRemaining(editionNumber1);
      totalRemaining.should.be.eq.BN(3);
    });

    it('totalSupplyEdition', async () => {
      let totalSupplyEdition = await this.koda.totalSupplyEdition(editionNumber1);
      totalSupplyEdition.should.be.eq.BN(0);
    });

    it('totalAvailableEdition', async () => {
      let totalAvailableEdition = await this.koda.totalAvailableEdition(editionNumber1);
      totalAvailableEdition.should.be.eq.BN(3);
    });

    describe('once disabled edition is no longer active', async () => {

      beforeEach(async () => {
        const {logs} = await this.burner.deactivateOrReduceEditionSupply(editionNumber1, {from: artistAccount});
        this.logs = logs;
      })

      it('editionActive', async () => {
        let editionActive = await this.koda.editionActive(editionNumber1);
        editionActive.should.be.equal(false);
      });

      it('event populated', async () => {
        const event = this.logs[0];
        event.event.should.be.equal('EditionDeactivated');
        let {_editionNumber} = event.args;
        _editionNumber.should.be.eq.BN(editionNumber1);
      });
    });

  });

  describe('Will lower supply once edition has tokens issued from it', async () => {

    beforeEach(async () => {
      await this.koda.createActiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 3, {from: _owner});

      // Mint two tokens
      await this.koda.purchase(editionNumber2, {from: account2, value: edition2Price});
      await this.koda.purchase(editionNumber2, {from: account2, value: edition2Price});
    });

    it('editionActive', async () => {
      let editionActive = await this.koda.editionActive(editionNumber2);
      editionActive.should.be.equal(true);
    });

    it('totalRemaining', async () => {
      let totalRemaining = await this.koda.totalRemaining(editionNumber2);
      totalRemaining.should.be.eq.BN(1);
    });

    it('totalSupplyEdition', async () => {
      let totalSupplyEdition = await this.koda.totalSupplyEdition(editionNumber2);
      totalSupplyEdition.should.be.eq.BN(2);
    });

    it('totalAvailableEdition', async () => {
      let totalAvailableEdition = await this.koda.totalAvailableEdition(editionNumber2);
      totalAvailableEdition.should.be.eq.BN(3);
    });

    describe('once disabled edition is no longer active', async () => {

      beforeEach(async () => {
        const {logs} = await this.burner.deactivateOrReduceEditionSupply(editionNumber2, {from: artistAccount});
        this.logs = logs;
      })

      it('editionActive', async () => {
        let editionActive = await this.koda.editionActive(editionNumber2);
        editionActive.should.be.equal(true); // still active but no more on sale a.k.a. soldout
      });

      it('totalRemaining', async () => {
        let totalRemaining = await this.koda.totalRemaining(editionNumber2);
        totalRemaining.should.be.eq.BN(0); // zero remaining
      });

      it('totalSupplyEdition', async () => {
        let totalSupplyEdition = await this.koda.totalSupplyEdition(editionNumber2);
        totalSupplyEdition.should.be.eq.BN(2);
      });

      it('totalAvailableEdition', async () => {
        let totalAvailableEdition = await this.koda.totalAvailableEdition(editionNumber2);
        totalAvailableEdition.should.be.eq.BN(2); // available reduced to 2
      });

      it('event populated', async () => {
        const event = this.logs[0];
        event.event.should.be.equal('EditionSupplyReduced');
        let {_editionNumber} = event.args;
        _editionNumber.should.be.eq.BN(editionNumber2);
      });
    });
  });

  describe('Guard conditions', async () => {

    beforeEach(async () => {
      await this.koda.createActiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistShare, edition2Price, editionTokenUri2, 3, {from: _owner});
    });

    it('fails if not called by artist', async () => {
      await assertRevert(
        this.burner.deactivateOrReduceEditionSupply(editionNumber2, {from: account2}),
        "Only from the edition artist account"
      );
    });

    it('fails if edition is already disabled', async () => {
      // disable edition
      this.koda.updateActive(editionNumber2, false, {from: _owner});

      await assertRevert(
        this.burner.deactivateOrReduceEditionSupply(editionNumber2, {from: artistAccount}),
        "Only when edition is active"
      );
    });

    it('fails if edition is sold out', async () => {
      // Sell out edition
      await this.koda.purchase(editionNumber2, {from: account2, value: edition2Price});
      await this.koda.purchase(editionNumber2, {from: account2, value: edition2Price});
      await this.koda.purchase(editionNumber2, {from: account2, value: edition2Price});

      await assertRevert(
        this.burner.deactivateOrReduceEditionSupply(editionNumber2, {from: artistAccount}),
        "Only when edition not sold out"
      );
    });

  });

});
