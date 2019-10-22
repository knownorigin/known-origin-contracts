const Promise = require('bluebird');
const _ = require('lodash');
const Eth = require('ethjs');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = 'nbCbdzC6IG9CF6hmvAVQ';
let mnemonic = require('../../../known-origin-web3-marketplace/mnemonic');

const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

const ipfsUploader = require('../../../known-origin-web3-marketplace/scripts/ipfs/ipfs-uploader');

const galleryData = {
  "artists": [
    {
      "name": "James O'Connell",
      "artworks": [
        {
          "artworkName": "Family tree",
          "ipfsPath": "family_tree",
          "edition": "JOCFAMTREE001DIG",
          "numberOfEditions": 1,
          "fiatCost": 25.00,
          "costInEth": 0.1
        },
        {
          "artworkName": "Family tree",
          "ipfsPath": "family_tree",
          "edition": "JOCFAMTREE001DIG",
          "numberOfEditions": 1,
          "fiatCost": 25.00,
          "costInEth": 0.1
        },
        {
          "artworkName": "Family tree",
          "ipfsPath": "family_tree",
          "edition": "JOCFAMTREE001DIG",
          "numberOfEditions": 1,
          "fiatCost": 25.00,
          "costInEth": 0.1
        }
      ]
    }
  ]
};

let promisifyGetBlockNumber = Promise.promisify(web3.eth.getBlockNumber);
let promisifyGetBlock = Promise.promisify(web3.eth.getBlock);

module.exports = function (deployer, network, accounts) {

  let _developerAccount = accounts[0];
  let _curatorAccount = accounts[1];

  if (network === 'ropsten' || network === 'rinkeby') {
    _developerAccount = new HDWalletProvider(mnemonic, `https://${network}.infura.io/${infuraApikey}`, 0).getAddress();
    _curatorAccount = '0x5bFFf3CB3231cF81487E80358b644f1A670Fd98b';
  }

  if (network === 'live') {
    let mnemonic_live = require('../../../known-origin-web3-marketplace/mnemonic_live');
    _developerAccount = new HDWalletProvider(mnemonic_live, `https://mainnet.infura.io/${infuraApikey}`, 0).getAddress();
    _curatorAccount = '0x5bFFf3CB3231cF81487E80358b644f1A670Fd98b';
  }

  console.log(`Running within network = ${network}`);
  console.log(`_curatorAccount = ${_curatorAccount}`);
  console.log(`_developerAccount = ${_developerAccount}`);

  deployer
    .then(() => KnownOriginDigitalAsset.deployed())
    .then((instance) => promisifyGetBlockNumber()
      .then((blockNumber) => {
        return promisifyGetBlock(blockNumber)
          .then((block) => {
            return {
              block, instance
            };
          });
      }))
    .then(({instance, block}) => {

      console.log(`Deployed contract to address = [${instance.address}] to network [${network}]`);

      if (network === 'ganache' || network === 'live' || network === 'ropsten' || network === 'rinkeby') {
        console.log(`Loading in seed data`);

        const _openingTime = block.timestamp + 1; // one second in the future

        return loadSeedData(instance, _curatorAccount, _openingTime);
      } else {
        console.log(`SKIPPING loading seed data as running on ${network}`);
      }

      return instance;
    });

};

const loadSeedData = (instance, _curatorAccount, _openingTime) => {

  let flatInserts = flattenTestData();

  // convert gallery.json into individual inserts decorated with IPFS data
  let populatedMintItems = _.flatMap(flatInserts, (insert) => {
    console.log(`Seeding test data for [${insert.artworkName}]`);
    return ipfsUploader.uploadMetaData(insert)
      .then((tokenUri) => {

        return _.map(_.range(0, insert.numberOfEditions), function (count) {
          console.log(`Populating Sourcing [${insert.edition}] - item [${count}]`);

          return {
            tokenUri,
            edition: insert.edition,
            costInWei: insert.costInWei.toString(10),
            openingTime: _openingTime
          };
        });
      });
  });

  // Each each set of inserts per edition, Promise.each is serial to prevent duplicate transaction issues
  return Promise.each(populatedMintItems, function (insertsForEditionArray) {
    console.log(`Minting [${insertsForEditionArray[0].edition}] - total to mint [${insertsForEditionArray.length}]`);

    // insert each series before moving on the to the next one
    return Promise.map(insertsForEditionArray, function ({tokenUri, edition, costInWei, openingTime}) {
      return instance.mint(
        tokenUri,
        require('Web3').utils.asciiToHex(edition),
        costInWei,
        openingTime,
        _curatorAccount
      );
    });
  });

};

const flattenTestData = () => {
  let flatInserts = [];

  _.forEach(galleryData.artists, (artist) => {

    let artistName = artist.name;

    _.forEach(artist.artworks, (artwork) => {

      let artworkName = artwork.artworkName;
      let ipfsPath = artwork.ipfsPath;

      let numberOfEditions = artwork.numberOfEditions;
      let edition = artwork.edition;
      if (edition.length !== 16) {
        throw new Error(`Edition ${edition} not 16 chars long`);
      }

      let fiatCost = artwork.fiatCost;
      let costInWei = Eth.toWei(artwork.costInEth, 'ether');

      flatInserts.push({
        numberOfEditions,
        artworkName,
        fiatCost,
        costInWei,
        ipfsPath,
        edition,
        artistName
      });

    });
  });

  return flatInserts;
};

/*
 "5777": {
 "events": {},
 "links": {},
 "address": "0x345ca3e014aaf5dca488057592ee47305d9b3e10",
 "transactionHash": "0x5494484f9242d926c550fa95e4b03ee3e961fb5350b44f329aad7f1274fe561c"
 }
 */
