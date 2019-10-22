const KnownOriginDigitalAsset = artifacts.require('KnownOriginDigitalAsset');

module.exports = async function (deployer, network, accounts) {

  let _curatorAccount = accounts[0];

  let contract = await KnownOriginDigitalAsset.deployed();

  // removes edition completely as only one piece
  await contract.burn(0, {from: _curatorAccount});

  // removes 2 from an edition
  await contract.burn(1, {from: _curatorAccount});
  await contract.burn(2, {from: _curatorAccount});

};
