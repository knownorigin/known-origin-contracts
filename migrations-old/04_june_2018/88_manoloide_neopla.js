const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

const loadSeedData = require('../../../known-origin-web3-marketplace/scripts/migrations/load-seed-data-v1');
const loadContractCredentials = require('../../../known-origin-web3-marketplace/scripts/migrations/loadContractCredentials');
const blocktimestampPlusOne = require('../../../known-origin-web3-marketplace/scripts/migrations/blocktimestampPlusOne');



const ARTWORK = {
  "ipfsPath": "manoloide_neopla",
  "edition": "MNONEOPLA0001DIG",
  "costInEth": 0.068 //40 USD
};

const galleryData = {
  "artists": [
    {
      "name": "Manoloide",
      "artworks": [ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK, ARTWORK]
    }
  ]
};

const artistAccount = "0x6fb7f9d87d2742baba47f61207d57ac3c0443482";

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
