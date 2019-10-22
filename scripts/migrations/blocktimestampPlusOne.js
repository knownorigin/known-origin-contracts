const Promise = require('bluebird');

module.exports = function (web3) {

  let promisifyGetBlockNumber = Promise.promisify(web3.eth.getBlockNumber);
  let promisifyGetBlock = Promise.promisify(web3.eth.getBlock);

  return promisifyGetBlockNumber()
    .then((blockNumber) => {
      console.log(`blockNumber ${blockNumber}`);

      return promisifyGetBlock(blockNumber)
        .then((block) => {
          console.log(`block ${block}`);

          const _openingTime = block.timestamp + 1; // 1 sec
          console.log(`opening time ${_openingTime}`);

          return _openingTime;
        });
    });
};
