const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const ArtistEditionBurner = artifacts.require('ArtistEditionBurner');

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
    _koAccount = new HDWalletProvider(require('../mnemonic_live'), `https://mainnet.infura.io/v3/${infuraApikey}`, 0).getAddress();
  }

  const koda = await KnownOriginDigitalAssetV2.deployed();

  // Get deployed contracts
  console.log(`KODA V2 [${koda.address}]`);

  // Deploy marketplace
  await deployer.deploy(ArtistEditionBurner,
    koda.address,
    {from: _koAccount}
  );

  const burner = await ArtistEditionBurner.deployed();
  console.log(`ArtistEditionBurner deployed [${burner.address}]`);

  // whitelist burner contract
  const ROLE_KNOWN_ORIGIN = 1;
  await koda.addAddressToAccessControl(burner.address, ROLE_KNOWN_ORIGIN, {from: _koAccount});
};
