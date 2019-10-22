const Eth = require('ethjs');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = 'nbCbdzC6IG9CF6hmvAVQ';
let mnemonic = require('../../../known-origin-web3-marketplace/mnemonic');

const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

module.exports = function (deployer, network, accounts) {

  let _developerAccount = accounts[0];
  let _curatorAccount = accounts[1];

  if (network === 'ropsten' || network === 'rinkeby') {
    _developerAccount = new HDWalletProvider(mnemonic, `https://${network}.infura.io/${infuraApikey}`, 0).getAddress();
    _curatorAccount = '0x5bFFf3CB3231cF81487E80358b644f1A670Fd98b';
  }

  if (network === 'live') {
    let mnemonic_live = require('../../../known-origin-web3-marketplace/mnemonic_live');
    _developerAccount = new HDWalletProvider(mnemonic_live, `https://mainnet.infura.io/${infuraApikey}`, 0).getAddress();
    _curatorAccount = '0x5bFFf3CB3231cF81487E80358b644f1A670Fd98b';
  }

  console.log(`Running within network = ${network}`);
  console.log(`_curatorAccount = ${_curatorAccount}`);
  console.log(`_developerAccount = ${_developerAccount}`);

  if (network === 'live' || network === 'ropsten' || network === 'rinkeby') {
    deployer
      .then(() => KnownOriginDigitalAsset.deployed())
      .then((instance) => {

        let costInWei = Eth.toWei(1.9, 'ether');

        return instance.setPriceInWei(19, costInWei);
      });
  } else {
    console.log(`SKIPPING loading seed data as running on ${network}`);
  }
};

