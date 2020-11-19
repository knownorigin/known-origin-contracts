const TokenMarketplace = artifacts.require('TokenMarketplace');
const TokenMarketplaceV2 = artifacts.require('TokenMarketplaceV2');
const ArtistAcceptingBids = artifacts.require('ArtistAcceptingBids');
const ArtistEditionControls = artifacts.require('ArtistEditionControls');
const SelfServiceEditionCuration = artifacts.require('SelfServiceEditionCuration');
const SelfServiceEditionCurationV2 = artifacts.require('SelfServiceEditionCurationV2');
const SelfServiceEditionCurationV3 = artifacts.require('SelfServiceEditionCurationV3');
const SelfServiceEditionCurationV4 = artifacts.require('SelfServiceEditionCurationV4');

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

  const _0_POINT_0_1_ETH = '10000000000000000';
  const _17_POINT_5_PERCENT = '175';

  const tokenMarketplace = await TokenMarketplace.deployed();
  await tokenMarketplace.setMinBidAmount(_0_POINT_0_1_ETH, {from: _koAccount});
  console.log(`TokenMarketplace V1 [${tokenMarketplace.address}] updated to [${(await tokenMarketplace.minBidAmount()).toString()}]`);

  const tokenMarketplaceV2 = await TokenMarketplaceV2.deployed();
  await tokenMarketplaceV2.setMinBidAmount(_0_POINT_0_1_ETH, {from: _koAccount});
  console.log(`TokenMarketplace V2 [${tokenMarketplaceV2.address}] updated to [${(await tokenMarketplaceV2.minBidAmount()).toString()}]`);

  await tokenMarketplaceV2.setArtistRoyaltyPercentage(_17_POINT_5_PERCENT, {from: _koAccount});
  console.log(`TokenMarketplace V2 [${tokenMarketplaceV2.address}] royalties set to [${(await tokenMarketplaceV2.artistRoyaltyPercentage()).toString()}]`);

  const artistAcceptingBidsV2 = await ArtistAcceptingBids.deployed();
  await artistAcceptingBidsV2.setMinBidAmount(_0_POINT_0_1_ETH, {from: _koAccount});
  console.log(`Auction V1 [${artistAcceptingBidsV2.address}] updated to [${(await artistAcceptingBidsV2.minBidAmount()).toString()}]`);

  const selfServiceV4 = await SelfServiceEditionCurationV4.deployed();
  await selfServiceV4.setMinPricePerEdition(_0_POINT_0_1_ETH, {from: _koAccount});
  console.log(`Self Service V4 [${selfServiceV4.address}] updated to [${(await selfServiceV4.minPricePerEdition()).toString()}]`);

  const selfServiceV1 = await SelfServiceEditionCuration.deployed();
  let isPaused = await selfServiceV1.paused();
  if (!isPaused) {
    await selfServiceV1.pause({from: _koAccount});
    console.log(`Self Service V1 [${selfServiceV1.address}] paused`);
  }

  const selfServiceV2 = await SelfServiceEditionCurationV2.deployed();
  isPaused = await selfServiceV2.paused();
  if (!isPaused) {
    await selfServiceV2.pause({from: _koAccount});
    console.log(`Self Service V2 [${selfServiceV2.address}] paused`);
  }

  const selfServiceV3 = await SelfServiceEditionCurationV3.deployed();
  isPaused = await selfServiceV3.paused();
  if (!isPaused) {
    await selfServiceV3.pause({from: _koAccount});
    console.log(`Self Service V3 [${selfServiceV3.address}] paused`);
  }

  const artistAcceptingBidsV1 = await ArtistAcceptingBids.deployed();
  isPaused = await artistAcceptingBidsV1.paused();
  if (!isPaused) {
    await artistAcceptingBidsV1.pause({from: _koAccount});
    console.log(`Auction V1 [${artistAcceptingBidsV1.address}] paused`);
  }

  const artistEditionControlsV1 = await ArtistEditionControls.deployed();
  isPaused = await artistEditionControlsV1.paused();
  if (!isPaused) {
    await artistEditionControlsV1.pause({from: _koAccount});
    console.log(`Controls V1 [${artistEditionControlsV1.address}] paused`);
  }
};
