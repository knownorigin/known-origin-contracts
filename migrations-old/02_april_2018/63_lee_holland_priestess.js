const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

const loadSeedData = require('../../../known-origin-web3-marketplace/scripts/migrations/load-seed-data-v1');
const loadContractCredentials = require('../../../known-origin-web3-marketplace/scripts/migrations/loadContractCredentials');
const blocktimestampPlusOne = require('../../../known-origin-web3-marketplace/scripts/migrations/blocktimestampPlusOne');

const ARTWORK = {
  "ipfsPath": "lee_holland_priestess",
  "edition": "LHDPRIESTESS0001", // Live = LHDPRIESTESS0001
  "costInEth": 0.09
};

const galleryData = {
  "artists": [
    {
      "name": "Lee Holland",
      "artworks": [ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK]
    }
  ]
};

// const artistAccount = "0x109ab2d5d70229bebfb4961821feafc66fa90150"; <-- old address (live)
const artistAccount = "0xf397B52432fE7149Ce74849B15223f4502cdB1d3"; // <-- should be this for the future

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
