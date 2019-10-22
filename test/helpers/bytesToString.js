
module.exports = function bytesToString(bytes) {
  return web3.utils.toAscii(bytes).replace(/\0/g, '');
};
