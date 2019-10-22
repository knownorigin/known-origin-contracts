const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

const loadSeedData = require('../../../known-origin-web3-marketplace/scripts/migrations/load-seed-data-v1');
const loadContractCredentials = require('../../../known-origin-web3-marketplace/scripts/migrations/loadContractCredentials');
const blocktimestampPlusOne = require('../../../known-origin-web3-marketplace/scripts/migrations/blocktimestampPlusOne');

const assetType = 'DIG';
const artistCode = 'STR';

const ARTWORK = {
  "ipfsPath": "stan_ragets_apparently_aimless",
  "edition": `${artistCode}APPAIMLESS${assetType}`,
  "costInEth": 0.599 // $300
};


const galleryData = {
  "artists": [
    {
      'name': 'Stan Ragets',
      "artworks": [ARTWORK]
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
        return loadSeedData(instance, _artistAccount, _openingTime, galleryData, _developerAccount);
      } else {
        console.log(`SKIPPING loading seed data as running on ${network}`);
      }

      return instance;
    });
};
