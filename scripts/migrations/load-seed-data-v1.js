const _ = require('lodash');
const Promise = require('bluebird');

const ipfsUploader = require('../ipfs/ipfs-uploader');
const flattenArtistData = require('./flatten-seed-data');
const flattenAttributesMetaData = require('./metadata-attributes-flattener');

module.exports = function (instance, _artistAccount, _openingTime, galleryData, _developerAccount) {

  flattenAttributesMetaData();

  const flatInserts = flattenArtistData(galleryData);

  // convert gallery.json into individual inserts decorated with IPFS data
  const populatedMintItems = _.flatMap(flatInserts, (insert) => {
    console.log(`Seeding data for [${insert.ipfsPath}]`);
    return ipfsUploader.uploadMetaData(insert)
      .then((tokenUri) => {

        return _.map(_.range(0, 1), function (count) {
          console.log(`Sourcing [${insert.edition}] - item [${count}]`);

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

    // insert each series before moving on the to the next one
    return Promise.map(insertsForEditionArray, function ({tokenUri, edition, costInWei, openingTime}) {

      console.log(`Minting: T: ${tokenUri} E: ${edition} C: ${costInWei} O: ${openingTime} A: ${_artistAccount}`);

      return instance.mint(
        tokenUri,
        require('Web3').utils.asciiToHex(edition),
        costInWei,
        openingTime,
        _artistAccount,
        {from: _developerAccount}
      );
    });
  });

};

