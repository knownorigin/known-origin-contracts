const toBN = require('./toBN');

async function getGasCosts(receipt) {
  let tx = await web3.eth.getTransaction(receipt.tx);
  let gasPrice = toBN(tx.gasPrice);
  return gasPrice.mul(toBN(receipt.receipt.gasUsed));
}


module.exports = getGasCosts;
