pragma solidity ^0.4.18;

import "../v1/ERC721Receiver.sol";

contract ERC721ReceiverMockV1 is ERC721Receiver {
  bytes4 retval;
  bool reverts;

  event Received(address _address, uint256 _tokenId, bytes _data, uint256 _gas);

  function ERC721ReceiverMockV1(bytes4 _retval, bool _reverts) public {
    retval = _retval;
    reverts = _reverts;
  }

  function onERC721Received(address _address, uint256 _tokenId, bytes _data) public returns(bytes4) {
    require(!reverts);
    Received(_address, _tokenId, _data, msg.gas);
    return retval;
  }
}
