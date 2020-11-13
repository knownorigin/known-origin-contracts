const TokenMarketplace = artifacts.require('TokenMarketplace');
const TokenMarketplaceV2 = artifacts.require('TokenMarketplaceV2');
const ArtistAcceptingBids = artifacts.require('ArtistAcceptingBids');
const ArtistEditionControls = artifacts.require('ArtistEditionControls');

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

  const _0_POINT_0_1_ETH = '10000000';
  const _17_POINT_5_PERCENT = '175';

  const tokenMarketplace = await TokenMarketplace.deployed();
  console.log(`TokenMarketplace V1 [${tokenMarketplace.address}] updated to [${(await this.tokenMarketplace.minBidAmount()).toString}]`);
  await this.tokenMarketplace.setMinBidAmount(_0_POINT_0_1_ETH, {from: _koAccount});

  const tokenMarketplaceV2 = await TokenMarketplaceV2.deployed();
  await this.tokenMarketplaceV2.setMinBidAmount(_0_POINT_0_1_ETH, {from: _koAccount});
  console.log(`TokenMarketplace V2 [${tokenMarketplaceV2.address}] updated to [${(await this.tokenMarketplaceV2.minBidAmount()).toString}]`);

  await this.tokenMarketplaceV2.setArtistRoyaltyPercentage(_17_POINT_5_PERCENT, {from: _koAccount});
  console.log(`TokenMarketplace V2 [${tokenMarketplaceV2.address}] royalties set to [${(await this.tokenMarketplaceV2.artistRoyaltyPercentage()).toString}]`);

  const artistAcceptingBidsV2 = await ArtistAcceptingBids.deployed();
  await this.artistAcceptingBidsV2.setMinBidAmount(_0_POINT_0_1_ETH, {from: _koAccount});
  console.log(`Auction V1 [${artistAcceptingBidsV2.address}] updated to [${(await this.artistAcceptingBidsV2.minBidAmount()).toString}]`);

  const artistAcceptingBidsV1 = await ArtistAcceptingBids.deployed();
  await this.artistAcceptingBidsV1.pause({from: _koAccount});
  console.log(`Auction V1 [${artistAcceptingBidsV1.address}] paused`);

  const artistEditionControlsV1 = await ArtistEditionControls.deployed();
  await this.artistEditionControlsV1.pause({from: _koAccount});
  console.log(`Controls V1 [${artistEditionControlsV1.address}] paused`);
};
