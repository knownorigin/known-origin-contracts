module.exports = (n) => {
  return web3.utils.toBN(web3.utils.toWei(n.toString("10"), 'ether'));
};
