const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

const loadSeedData = require('../../../known-origin-web3-marketplace/scripts/migrations/load-seed-data-v2');
const loadContractCredentials = require('../../../known-origin-web3-marketplace/scripts/migrations/loadContractCredentials');
const blocktimestampPlusOne = require('../../../known-origin-web3-marketplace/scripts/migrations/blocktimestampPlusOne');

const assetType = 'DIG'; // 3
const artistCode = 'OBX'; // 3

const artworkCode = 'DDF2000000'; // 10

const ARTWORK = {
  'ipfsPath': 'obxium_ddf2',
  'edition': `${artistCode}${artworkCode}${assetType}`,
  'costInEth': 0.084 // $40
};

const galleryData = {
  'artists': [
    {
      'artworks': [ARTWORK]
    }
  ]
};

module.exports = function (deployer, network, accounts) {

  // uses artist code to find ETH address
  const {_curatorAccount, _developerAccount, _artistAccount} = loadContractCredentials(
    network,
    accounts,
    null,
    artistCode
  );

  deployer
    .then(() => KnownOriginDigitalAsset.deployed())
    .then((instance) => {
      console.log(`Deployed contract to address = [${instance.address}] to network [${network}]`);

      return blocktimestampPlusOne(web3).then((_openingTime) => {
        return {
          instance,
          _openingTime
        };
      });
    })
    .then(({instance, _openingTime}) => {

      if (network === 'ganache' || network === 'live' || network === 'ropsten' || network === 'rinkeby') {
        return loadSeedData({web3, instance, network, _artistAccount, _openingTime, galleryData, _developerAccount});
      } else {
        console.log(`SKIPPING loading seed data as running on ${network}`);
      }

      return instance;
    });
};
