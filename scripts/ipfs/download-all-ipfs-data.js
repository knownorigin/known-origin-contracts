const fs = require('fs');
const _ = require('lodash');

const axios = require('axios');

/**
 * Really basic script which will look at our cache and download all IPFS data we have, good for checking new assets
 */
const downloadIpfsData = () => {

  const rawCache = require('../../config/data/ipfs_data/cache.json');

  _.map(rawCache, (value, key) => {
    console.log(`https://ipfs.infura.io/ipfs/${value}`);
    return axios.get(`https://ipfs.infura.io/ipfs/${value}`)
      .then((response) => {
        let path = `./config/data/downloaded_ipfs_data/${key}.json`;

        // if not present touch an empty file
        if (!fs.existsSync(path)) {
          fs.closeSync(fs.openSync(path, 'w'));
        }

        console.log(`Writing data to [${path}]`);
        fs.writeFileSync(path, JSON.stringify(response.data, null, 4));
      });
  });
};

module.exports = downloadIpfsData;


downloadIpfsData();
