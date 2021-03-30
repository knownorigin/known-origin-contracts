const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const ArtistAcceptingBidsV2 = artifacts.require('ArtistAcceptingBidsV2');

const SelfServiceEditionCurationV3 = artifacts.require('SelfServiceEditionCurationV3');

const SelfServiceAccessControls = artifacts.require('SelfServiceAccessControls');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = '';

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
  const accessControls = await SelfServiceAccessControls.deployed();

  // Get deployed contracts
  console.log(`KODA V2 [${koda.address}] Auction V2 [${auction.address}] AccessControls V1 [${accessControls.address}]`);

  // Deploy the self service contract
  await deployer.deploy(SelfServiceEditionCurationV3, koda.address, auction.address, accessControls.address, {from: _koAccount});

  const selfServiceV3 = await SelfServiceEditionCurationV3.deployed();
  console.log("Self service address", selfServiceV3.address);

  // whitelist self service so it can mint new editions
  const ROLE_KNOWN_ORIGIN = 1;
  await koda.addAddressToAccessControl(selfServiceV3.address, ROLE_KNOWN_ORIGIN, {from: _koAccount});

  // whitelist self service address so it can enable auctions
  await auction.addAddressToWhitelist(selfServiceV3.address, {from: _koAccount});
};
