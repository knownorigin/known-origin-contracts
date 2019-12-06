const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const ArtistAcceptingBidsV2 = artifacts.require('ArtistAcceptingBidsV2');

const SelfServiceEditionCurationV4 = artifacts.require('SelfServiceEditionCurationV4');

const SelfServiceAccessControls = artifacts.require('SelfServiceAccessControls');
const SelfServiceFrequencyControls = artifacts.require('SelfServiceFrequencyControls');

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
  const accessControls = await SelfServiceAccessControls.deployed();

  // Get deployed contracts
  console.log(`KODA V2 [${koda.address}] Auction V2 [${auction.address}] AccessControls V1 [${accessControls.address}]`);

  // Deploy new frequency controls
  await deployer.deploy(SelfServiceFrequencyControls, {from: _koAccount});

  const frequencyControls = await SelfServiceFrequencyControls.deployed();
  console.log(`Frequency controls deployed [${frequencyControls.address}]`);

  // Deploy the self service contract
  await deployer.deploy(SelfServiceEditionCurationV4,
    koda.address,
    auction.address,
    accessControls.address,
    frequencyControls.address,
    {from: _koAccount}
  );

  const selfServiceV4 = await SelfServiceEditionCurationV4.deployed();
  console.log('Self service address', selfServiceV4.address);

  // whitelist self service so it can mint new editions
  const ROLE_KNOWN_ORIGIN = 1;
  await koda.addAddressToAccessControl(selfServiceV4.address, ROLE_KNOWN_ORIGIN, {from: _koAccount});

  // whitelist self service address so it can enable auctions
  await auction.addAddressToWhitelist(selfServiceV4.address, {from: _koAccount});

  // whitelist self service address so it can call frequency controls
  await frequencyControls.addAddressToWhitelist(selfServiceV4.address, {from: _koAccount});

};
