const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const ArtistAcceptingBidsV2 = artifacts.require('ArtistAcceptingBidsV2');
const SelfServiceEditionCurationV2 = artifacts.require('SelfServiceEditionCurationV2');
const SelfServiceAccessControls = artifacts.require('SelfServiceAccessControls');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = '4396873c00c84479991e58a34a54ebd9';

module.exports = async function (deployer, network, accounts) {

  let _koAccount = accounts[0];
  console.log(`Running within network = ${network}`);
  console.log(`_koAccount = ${_koAccount}`);

  // Load in other accounts for different networks
  if (network === 'ropsten' || network === 'ropsten-fork' || network === 'rinkeby' || network === 'rinkeby-fork') {
    _koAccount = new HDWalletProvider(process.env.KNOWN_ORIGIN_MNEMONIC, `https://${network}.infura.io/v3/${infuraApikey}`, 0).getAddress();
  }

  if (network === 'live' || network === 'live-fork') {
    _koAccount = new HDWalletProvider(require('../../known-origin-web3-marketplace/mnemonic_live'), `https://mainnet.infura.io/v3/${infuraApikey}`, 0).getAddress();
  }

  const koda = await KnownOriginDigitalAssetV2.deployed();
  const auction = await ArtistAcceptingBidsV2.deployed();

  // Deploy access controls
  await deployer.deploy(SelfServiceAccessControls, {from: _koAccount});
  const accessControls = await SelfServiceAccessControls.deployed();
  console.log("Access controls address", accessControls.address);

  // Deploy the self service contract
  await deployer.deploy(SelfServiceEditionCurationV2, koda.address, auction.address, accessControls.address, {from: _koAccount});

  const selfServiceV2 = await SelfServiceEditionCurationV2.deployed();
  console.log("Self service address", selfServiceV2.address);

  // whitelist self service so it can mint new editions
  const ROLE_KNOWN_ORIGIN = 1;
  await koda.addAddressToAccessControl(selfServiceV2.address, ROLE_KNOWN_ORIGIN, {from: _koAccount});

  // whitelist self service address so it can enable auctions
  await auction.addAddressToWhitelist(selfServiceV2.address, {from: _koAccount});
};
