const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const ArtistEditionControlsV2 = artifacts.require('ArtistEditionControlsV2');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = 'nbCbdzC6IG9CF6hmvAVQ';

module.exports = async function (deployer, network, accounts) {

  const ROLE_KNOWN_ORIGIN = 1;
  const ROLE_MINTER = 2;

  let _koAccount = accounts[0];
  console.log(`Running within network = ${network}`);
  console.log(`_koAccount = ${_koAccount}`);

  // Load in other accounts for different networks
  if (network === 'ropsten' || network === 'ropsten-fork' || network === 'rinkeby' || network === 'rinkeby-fork') {
    _koAccount = new HDWalletProvider(process.env.KNOWN_ORIGIN_MNEMONIC, `https://${network}.infura.io/${infuraApikey}`, 0).getAddress();
  }

  if (network === 'live' || network === 'live-fork') {
    _koAccount = new HDWalletProvider(require('../../known-origin-web3-marketplace/mnemonic_live'), `https://mainnet.infura.io/${infuraApikey}`, 0).getAddress();
  }

  const koda = await KnownOriginDigitalAssetV2.deployed();

  const controls = await deployer.deploy(ArtistEditionControlsV2, koda.address, {from: _koAccount});

  await koda.addAddressToAccessControl(controls.address, ROLE_KNOWN_ORIGIN, {from: _koAccount});

  await koda.addAddressToAccessControl(controls.address, ROLE_MINTER, {from: _koAccount});
};
