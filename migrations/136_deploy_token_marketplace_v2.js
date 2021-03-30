const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const TokenMarketplaceV2 = artifacts.require('TokenMarketplaceV2');

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
    _koAccount = new HDWalletProvider(require('../mnemonic_live'), `https://mainnet.infura.io/v3/${infuraApikey}`, 0).getAddress();
  }

  const koda = await KnownOriginDigitalAssetV2.deployed();

  // Get deployed contracts
  console.log(`KODA V2 [${koda.address}]`);

  // Deploy marketplace
  await deployer.deploy(TokenMarketplaceV2,
    koda.address,
    _koAccount,
    {from: _koAccount}
  );

  const tokenMarketplace = await TokenMarketplaceV2.deployed();
  console.log(`TokenMarketplace V2 deployed [${tokenMarketplace.address}]`);
};
