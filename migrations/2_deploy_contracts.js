const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = 'nbCbdzC6IG9CF6hmvAVQ';
const mnemonic = process.env.KNOWN_ORIGIN_MNEMONIC;

module.exports = function (deployer, network, accounts) {

  let _developerAccount = accounts[0];
  let _curatorAccount = accounts[1];

  // Load in other accounts for different networks
  if (network === 'ropsten' || network === 'rinkeby') {
    _developerAccount = new HDWalletProvider(mnemonic, `https://${network}.infura.io/${infuraApikey}`, 0).getAddress();
    _curatorAccount = '0x5bFFf3CB3231cF81487E80358b644f1A670Fd98b';
  }

  if (network === 'live') {
    let mnemonic_live = require('../../known-origin-web3-marketplace/mnemonic_live');
    _developerAccount = new HDWalletProvider(mnemonic_live, `https://mainnet.infura.io/${infuraApikey}`, 0).getAddress();
    _curatorAccount = '0x5bFFf3CB3231cF81487E80358b644f1A670Fd98b';
  }

  console.log(`Running within network = ${network}`);
  console.log(`_curatorAccount = ${_curatorAccount}`);
  console.log(`_developerAccount = ${_developerAccount}`);

  deployer.deploy(KnownOriginDigitalAsset, _curatorAccount);
};
