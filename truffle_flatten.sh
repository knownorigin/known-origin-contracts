#!/usr/bin/env bash

node ./node_modules/.bin/truffle-flattener ./contracts/Migrations.sol > ./contracts-flat/FLAT-Migrations.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v1/KnownOriginDigitalAsset.sol > ./contracts-flat/FLAT-KnownOriginDigitalAsset.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/KnownOriginDigitalAssetV2.sol > ./contracts-flat/FLAT-KnownOriginDigitalAssetV2.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/auctions/ArtistAcceptingBids.sol > ./contracts-flat/FLAT-ArtistAcceptingBids.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/tools/ArtistEditionControls.sol > ./contracts-flat/FLAT-ArtistEditionControls.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/auctions/ArtistAcceptingBidsV2.sol > ./contracts-flat/FLAT-ArtistAcceptingBidsV2.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/tools/ArtistEditionControlsV2.sol > ./contracts-flat/FLAT-ArtistEditionControlsV2.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/tools/SelfServiceEditionCuration.sol > ./contracts-flat/FLAT-SelfServiceEditionCuration.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/tools/SelfServiceEditionCurationV2.sol > ./contracts-flat/FLAT-SelfServiceEditionCurationV2.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/tools/SelfServiceEditionCurationV3.sol > ./contracts-flat/FLAT-SelfServiceEditionCurationV3.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/tools/SelfServiceAccessControls.sol > ./contracts-flat/FLAT-SelfServiceAccessControls.sol;

