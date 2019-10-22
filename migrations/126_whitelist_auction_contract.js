const ArtistAcceptingBids = artifacts.require('ArtistAcceptingBids');
const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = 'nbCbdzC6IG9CF6hmvAVQ';

module.exports = async function (deployer, network, accounts) {

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

  const ROLE_MINTER = 2;

  const koda = await KnownOriginDigitalAssetV2.deployed();
  const auction = await ArtistAcceptingBids.deployed();

  console.log("Auction address", auction.address);

  await koda.addAddressToAccessControl(auction.address, ROLE_MINTER, {from: _koAccount});
};
