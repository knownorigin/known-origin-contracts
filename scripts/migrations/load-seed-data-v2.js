const _ = require('lodash');
const Promise = require('bluebird');

const ipfsUploader = require('../ipfs/ipfs-uploader');
const flattenArtistData = require('./flatten-seed-data');
const flattenAttributesMetaData = require('./metadata-attributes-flattener');

module.exports = function ({web3, instance, network, _artistAccount, _openingTime, galleryData, _developerAccount}) {

  flattenAttributesMetaData();

  const flatData = flattenArtistData(galleryData);

  const {gas, gasPrice} = require('../../truffle')['networks'][network];

  let getTransactionCount = Promise.promisify(web3.eth.getTransactionCount);
  let sendTransaction = Promise.promisify(web3.eth.sendTransaction);

  // Assume all ipfs data the same for each call
  console.log(`Upload IPFS data for [${flatData[0].ipfsPath}]`);

  return ipfsUploader.uploadMetaData(flatData[0])
    .then((tokenUri) => {

      // Get current transaction nonce
      return getTransactionCount(_developerAccount)
        .then((accountNonce) => {
          console.log("Current account nonce", accountNonce);

          // Each each set of inserts per edition, Promise.each is serial to prevent duplicate transaction issues
          return Promise.all(_.map(flatData, function ({costInWei, ipfsPath, edition}) {

            console.log(`Minting: T: ${tokenUri} E: ${edition} C: ${costInWei} O: ${_openingTime} A: ${_artistAccount}`);

            // Get the KO ABI
            const KnownOriginMarketPlace = new web3.eth.Contract(require('../abi/KnownOriginV1_ABI'), instance.address);

            // Generate the raw transaction
            // const rawTransaction = KnownOriginMarketPlace.mint.request(tokenUri, web3.utils.asciiToHex(edition), costInWei.toString(10), _openingTime, _artistAccount, {from: _developerAccount});
            const rawTransaction = KnownOriginMarketPlace.methods.mint(tokenUri, web3.utils.asciiToHex(edition), costInWei.toString(10), _openingTime, _artistAccount).encodeABI();

            // Send raw transaction, bumping the nonce for each once
            let response = sendTransaction({
              from: _developerAccount,
              to: instance.address,
              data: rawTransaction,
              gas: gas || 4075039,
              gasPrice: gasPrice || 35000000000,
              nonce: accountNonce
            });

            // Bump nonce value
            accountNonce = accountNonce + 1;

            return response;
          }));
        });
    });
};

