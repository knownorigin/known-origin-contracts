#!/usr/bin/env bash

node ./node_modules/.bin/truffle-flattener ./contracts/Migrations.sol > ./contracts-flat/FLAT-Migrations.sol;

### KODA V1
node ./node_modules/.bin/truffle-flattener ./contracts/v1/KnownOriginDigitalAsset.sol > ./contracts-flat/FLAT-KnownOriginDigitalAsset.sol;

### KODA V2
node ./node_modules/.bin/truffle-flattener ./contracts/v2/KnownOriginDigitalAssetV2.sol > ./contracts-flat/FLAT-KnownOriginDigitalAssetV2.sol;

### Artist controls
node ./node_modules/.bin/truffle-flattener ./contracts/v2/artist-controls/ArtistEditionControls.sol > ./contracts-flat/FLAT-ArtistEditionControls.sol;
node ./node_modules/.bin/truffle-flattener ./contracts/v2/artist-controls/ArtistEditionControlsV2.sol > ./contracts-flat/FLAT-ArtistEditionControlsV2.sol;

### Auctions
node ./node_modules/.bin/truffle-flattener ./contracts/v2/auctions/ArtistAcceptingBids.sol > ./contracts-flat/FLAT-ArtistAcceptingBids.sol;
node ./node_modules/.bin/truffle-flattener ./contracts/v2/auctions/ArtistAcceptingBidsV2.sol > ./contracts-flat/FLAT-ArtistAcceptingBidsV2.sol;

### Self Service

node ./node_modules/.bin/truffle-flattener ./contracts/v2/self-service/SelfServiceEditionCuration.sol > ./contracts-flat/FLAT-SelfServiceEditionCuration.sol;
node ./node_modules/.bin/truffle-flattener ./contracts/v2/self-service/SelfServiceEditionCurationV2.sol > ./contracts-flat/FLAT-SelfServiceEditionCurationV2.sol;
node ./node_modules/.bin/truffle-flattener ./contracts/v2/self-service/SelfServiceEditionCurationV3.sol > ./contracts-flat/FLAT-SelfServiceEditionCurationV3.sol;
node ./node_modules/.bin/truffle-flattener ./contracts/v2/self-service/SelfServiceEditionCurationV4.sol > ./contracts-flat/FLAT-SelfServiceEditionCurationV4.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/v2/self-service/SelfServiceAccessControls.sol > ./contracts-flat/FLAT-SelfServiceAccessControls.sol;
node ./node_modules/.bin/truffle-flattener ./contracts/v2/self-service/SelfServiceFrequencyControls.sol > ./contracts-flat/FLAT-SelfServiceFrequencyControls.sol;

