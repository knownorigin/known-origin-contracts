const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = 'nbCbdzC6IG9CF6hmvAVQ';

module.exports = function (deployer, network, accounts) {

  let _koAccount = accounts[0];

  // Load in other accounts for different networks
  if (network === 'ropsten' || network === 'rinkeby') {
    _koAccount = new HDWalletProvider(require('../../../known-origin-web3-marketplace/mnemonic'), `https://${network}.infura.io/${infuraApikey}`, 0).getAddress();
  }

  if (network === 'live') {
    _koAccount = new HDWalletProvider(require('../../../known-origin-web3-marketplace/mnemonic_live'), `https://mainnet.infura.io/${infuraApikey}`, 0).getAddress();
  }

  console.log(`Running within network = ${network}`);
  console.log(`_koAccount = ${_koAccount}`);

  return deployer.deploy(KnownOriginDigitalAssetV2);
};
