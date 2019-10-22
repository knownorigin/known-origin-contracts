const {validateEdition} = require('./edition-utils');
const Eth = require('ethjs');

module.exports = (galleryData) => {
  let flatInserts = [];

  _.forEach(galleryData.artists, (artist) => {

    const artistName = artist.name;

    _.forEach(artist.artworks, (artwork) => {

      let ipfsPath = artwork.ipfsPath;

      let edition = artwork.edition;

      // This validates the edition
      validateEdition(edition);

      let costInWei = Eth.toWei(artwork.costInEth, 'ether');

      flatInserts.push({
        costInWei,
        ipfsPath,
        edition,
        artistName
      });

    });
  });

  return flatInserts;
};
