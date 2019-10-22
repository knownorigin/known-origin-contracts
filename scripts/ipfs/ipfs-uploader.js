const IPFS = require('ipfs-api');
const fs = require('fs');
const streams = require('memory-streams');
const _ = require('lodash');

const {validateEdition} = require('../migrations/edition-utils');

const ipfs = IPFS('ipfs.infura.io', '5001', {protocol: 'https'});

// Reset this cache file to { } to push fresh data to IPFS
const CACHE_FILE = './config/data/ipfs_data/cache.json';

//IPFS meta contract based on https://github.com/ethereum/eips/issues/721

/*
- meta upload should return full IPFS hash with corresponding subpaths in this format https://github.com/multiformats/multiaddr
- e.g. /ipfs/127.0.0.1/udp/1234
- example of specification https://ipfs.io/ipfs/QmZU8bKEG8fhcQwKoLHfjtJoKBzvUT5LFR3f8dEz86WdVeTransfer

/             -> (required) - root path  - full IPFS hash
/name         -> (required) - A name SHOULD be 50 characters or less, and unique amongst all NFTs tracked by this contract
/image        -> (optional) - it MUST contain a PNG, JPEG, or SVG image with at least 300 pixels of detail in each dimension
/description  -> (optional) - The description SHOULD be 1500 characters or less.
/other meta   -> (optional) - A contract MAY choose to include any number of additional subpaths
 */

const uploadMetaData = ({ipfsPath, edition}) => {
  console.log(`Attempting to upload files in [${ipfsPath}]`);

  // Check cache as to not upload duplicates
  let cachedTokenUri = getFromCache(ipfsPath);
  if (cachedTokenUri) {
    console.log(`Found cached version of [${ipfsPath}] - token URI ${cachedTokenUri}`);
    return Promise.resolve(cachedTokenUri);
  }

  let meta = require(`../../config/data/ipfs_data/${ipfsPath}/meta.json`);

  // Load in either a gif or a jpeg
  let image;
  if (fs.existsSync(`./config/data/ipfs_data/${ipfsPath}/low_res.gif`)) {
    image = fs.createReadStream(`./config/data/ipfs_data/${ipfsPath}/low_res.gif`);
  } else {
    image = fs.createReadStream(`./config/data/ipfs_data/${ipfsPath}/low_res.jpeg`);
  }

  let {assetType, artistCode} = validateEdition(edition);

  return ipfs.add([
      {
        path: `${ipfsPath}/image`,
        content: image,
      },
      {
        path: `${ipfsPath}/description`,
        content: new streams.ReadableStream(`${meta.description}`).read(),
      },
      {
        path: `${ipfsPath}/other`,
        content: fs.createReadStream(`./config/data/ipfs_data/${ipfsPath}/meta.json`),
      }
    ], {recursive: false}
  )
    .then((res) => {
      console.log('Uploaded meta file to IPFS', res);
      let metaPath = _.last(res);

      let ipfsData = {
        name: `${meta.artworkName}`,
        description: `${meta.description}`,
        attributes: meta.attributes,
        external_uri: `https://knownorigin.io/artists/${artistCode}/editions/${edition}`,
        image: `https://ipfs.infura.io/ipfs/${metaPath.hash}/image`,
        meta: `https://ipfs.infura.io/ipfs/${metaPath.hash}/other`
      };

      return ipfs.add([
        {
          path: `${ipfsPath}`,
          content: new streams.ReadableStream(JSON.stringify(ipfsData)).read(),
        }
      ])
        .then((res) => {
          console.log('Uploaded root file to IPFS', res);
          let rootHash = _.last(res);

          // TODO convert to multi address support https://github.com/multiformats/multiaddr

          // we use baseURI in contract so don't need base here (unlike above?)
          let tokenUri = `${rootHash.hash}`;

          cacheIpfsHashes(ipfsPath, tokenUri);

          return tokenUri;
        });
    });
};

const cacheIpfsHashes = (ipfsPath, tokenUri) => {
  let cache = JSON.parse(fs.readFileSync(CACHE_FILE));
  let updatedCache = _.set(cache, ipfsPath, tokenUri);
  console.log(updatedCache);
  fs.writeFileSync(CACHE_FILE, JSON.stringify(updatedCache, null, 4));
};

const getFromCache = (ipfsPath) => {
  let cache = JSON.parse(fs.readFileSync(CACHE_FILE));
  return _.get(cache, ipfsPath);
};

module.exports = {
  uploadMetaData: uploadMetaData
};

// To manually upload fresh IPFS data use this and invoke it on the commandland e.g. node ./scripts/ipfs-uploader.js
// uploadMetaData({ipfsPath: 'stina_jones_happy_fox'});
