const fs = require('fs');
const _ = require('lodash');
const fm = require('file-matcher');
const fileMatcher = new fm.FileMatcher();

const isArray = (value) => value instanceof Array;

function isString(x) {
  return Object.prototype.toString.call(x) === "[object String]"
}

function lowercaseAttributes(attributes) {
  let flatAttributes = {};
  _.forEach(attributes, (value, key) => {
    if (isString(value)) {
      flatAttributes[key] = value.toLowerCase();
    }
    else if (isArray(value)) {
      flatAttributes[key] = _.map(value, (innerVal) => {
        return isString(innerVal) ? innerVal.toLowerCase() : innerVal;
      });
    }
    else {
      flatAttributes[key] = value;
    }
  });
  return flatAttributes;
}


const flattenAttributesMetaData = () => {
  fileMatcher.find({
    path: './config/data/ipfs_data/',
    fileFilter: {
      fileNamePattern: '**/**/meta.json',
    },
    recursiveSearch: true
  })
    .then(files => {
      // console.log(files);
      _.forEach(files, (file) => {
        let meta = require(file);
        if (meta.attributes) {
          meta.attributes = lowercaseAttributes(meta.attributes);
          fs.writeFileSync(file, JSON.stringify(meta, null, 2));
        }
      });
    })
    .catch(error => {
      console.log(error);
    });
};

module.exports = flattenAttributesMetaData;
