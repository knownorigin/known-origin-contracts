const toBN = require('./toBN');

async function getBalance(address) {
  return toBN(await web3.eth.getBalance(address));
}

module.exports = getBalance;
