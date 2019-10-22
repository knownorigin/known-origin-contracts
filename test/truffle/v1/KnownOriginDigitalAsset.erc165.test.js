const {increaseTo, latest, duration, advanceBlock} = require('../../helpers/time');
const bnChai = require('bn-chai');
const {shouldSupportInterfaces} = require('../SupportsInterface.behavior');

const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

require('chai')
  .use(require('chai-as-promised'))
  .use(bnChai(web3.utils.BN))
  .should();

contract('KnownOriginDigitalAssetV1 erc165', function (accounts) {
  const _developmentAccount = accounts[0];
  const _curatorAccount = accounts[1];

  let _purchaseFromTime;

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    // developers will mine the contract and pass the curator account into it...
    this.token = await KnownOriginDigitalAsset.new(_curatorAccount, {from: _developmentAccount});
    _purchaseFromTime = latest(); // opens immediately

    await increaseTo(_purchaseFromTime + duration.seconds(1)); // force time to move 1 seconds so normal tests pass

    // set base commission rates
    await this.token.updateCommission(web3.utils.asciiToHex('DIG'), 12, 12, {from: _developmentAccount});
    await this.token.updateCommission(web3.utils.asciiToHex('PHY'), 24, 15, {from: _developmentAccount});
  });

  describe('ERC165 supportsInterface()', async function () {
    shouldSupportInterfaces([
      'ERC165',
      'ERC721',
      'ERC721Exists',
      'ERC721Enumerable',
      'ERC721Metadata',
    ]);
  });

});
