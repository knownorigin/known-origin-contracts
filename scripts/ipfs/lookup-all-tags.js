const fs = require('fs');
const _ = require('lodash');

const lookUptags = () => {
  const JSON_PATH = 'config/data/downloaded_ipfs_data';


  fs.readdir(JSON_PATH, (err, files) => {

    let tags = files.map(file => {
      // console.log(file);
      let data = JSON.parse(fs.readFileSync(`${JSON_PATH}/${file}`));

      const foundTags = _.get(data, 'attributes.tags', []);
      // console.log("foundTags", foundTags);
      return foundTags;
    });

    console.log(_.uniq(_.flatten(tags)));
  });


};

module.exports = lookUptags;


lookUptags();
