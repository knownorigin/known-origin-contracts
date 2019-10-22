const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

const loadSeedData = require('../../../known-origin-web3-marketplace/scripts/migrations/load-seed-data-v1');
const loadContractCredentials = require('../../../known-origin-web3-marketplace/scripts/migrations/loadContractCredentials');
const blocktimestampPlusOne = require('../../../known-origin-web3-marketplace/scripts/migrations/blocktimestampPlusOne');

const ARTWORK = {
  "ipfsPath": "aktiv_protesk_pebble",
  "edition": "AKPPEBBLE0000DIG",
  "costInEth": 0.008
};

const galleryData = {
  "artists": [
    {
      "name": "Aktiv Protesk",
      "artworks": [ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK/*, ARTWORK, ARTWORK*/]
    }
  ]
};

const artistAccount = "0x7DEc37c03ea5ca2C47ad2509BE6abAf8C63CDB39";

module.exports = function (deployer, network, accounts) {

  const {_curatorAccount, _developerAccount, _artistAccount} = loadContractCredentials(network, accounts, artistAccount);

  deployer
    .then(() => KnownOriginDigitalAsset.deployed())
    .then((instance) => {
      console.log(`Deployed contract to address = [${instance.address}] to network [${network}]`);

      return blocktimestampPlusOne(web3).then((_openingTime) => {
        return {
          instance,
          _openingTime
        }
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
