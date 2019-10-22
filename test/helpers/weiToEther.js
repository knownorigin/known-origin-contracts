module.exports = (n) => {
  return new web3.BigNumber(web3.fromWei(n, 'ether'));
};
