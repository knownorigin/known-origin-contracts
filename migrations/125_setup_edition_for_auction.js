const ArtistAcceptingBids = artifacts.require('ArtistAcceptingBids');

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

  const auction = await ArtistAcceptingBids.deployed();

  const aktivProtesk = '0xa2cD656f8461d2C186D69fFB8A4a5c10EFF0914d';

  await auction.setArtistsControlAddressAndEnabledEdition(18500, aktivProtesk, {from: _koAccount});
  await auction.setArtistsControlAddressAndEnabledEdition(18600, aktivProtesk, {from: _koAccount});
  await auction.setArtistsControlAddressAndEnabledEdition(18700, aktivProtesk, {from: _koAccount});
  await auction.setArtistsControlAddressAndEnabledEdition(18800, aktivProtesk, {from: _koAccount});
};
