const assertRevert = require('../../helpers/assertRevert');
const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const etherToWei = require('../../helpers/etherToWei');

contract('Pausable', function (accounts) {
  const _owner = accounts[0];

  const account1 = accounts[1];

  const artistAccount = accounts[8];
  const artistShare = 76;
  const editionType = 1;
  const editionNumber1 = 100000;
  const editionData1 = web3.utils.asciiToHex("editionData1");
  const editionTokenUri1 = "edition1";
  const edition1Price = etherToWei(0.1);

  beforeEach(async function () {
    this.token = await KnownOriginDigitalAssetV2.new({from: _owner});

    await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistShare, edition1Price, editionTokenUri1, 3, {from: _owner});
  });

  it('can perform normal process in non-pause', async function () {
    await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
    let tokens = await this.token.tokensOf(account1);
    tokens
      .map(e => e.toNumber())
      .should.be.deep.equal([editionNumber1 + 1]);
  });

  it('can not perform normal process in pause', async function () {
    await this.token.pause();
    await assertRevert(this.token.purchase(editionNumber1, {from: account1, value: edition1Price}));
  });

  it('should resume allowing normal process after pause is over', async function () {
    await this.token.pause();
    await this.token.unpause();

    await this.token.purchase(editionNumber1, {from: account1, value: edition1Price});
    let tokens = await this.token.tokensOf(account1);
    tokens
      .map(e => e.toNumber())
      .should.be.deep.equal([editionNumber1 + 1]);
  });

});
