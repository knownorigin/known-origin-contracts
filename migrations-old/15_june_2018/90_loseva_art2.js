const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset')

const loadSeedData = require('../../../known-origin-web3-marketplace/scripts/migrations/load-seed-data-v1')
const loadContractCredentials = require('../../../known-origin-web3-marketplace/scripts/migrations/loadContractCredentials')
const blocktimestampPlusOne = require('../../../known-origin-web3-marketplace/scripts/migrations/blocktimestampPlusOne')

const ARTWORK = {
  'ipfsPath': 'loseva_art2',
  'edition': 'LOSSER01ART02DIG',
  'costInEth': 0.061 //30 USD
}

const galleryData = {
  'artists': [
    {
      'name': 'L O S E V A', // is this required?
      'artworks': [ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK]
    }
  ]
}

module.exports = function (deployer, network, accounts) {

  // uses artist code to find ETH address
  const {_curatorAccount, _developerAccount, _artistAccount} = loadContractCredentials(
    network,
    accounts,
    null,
    'LOS'
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

}
