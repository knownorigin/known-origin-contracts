pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/access/Whitelist.sol";
import "../interfaces/ISelfServiceFrequencyControls.sol";

contract SelfServiceFrequencyControls is ISelfServiceFrequencyControls, Whitelist {
  using SafeMath for uint256;

  // frozen out for..
  uint256 public freezeWindow = 1 days;

  // When the current time period started
  mapping(address => uint256) public frozenTil;

  constructor() public {
    super.addAddressToWhitelist(msg.sender);
  }

  function canCreateNewEdition(address minter) external view returns (bool) {
    return !_isFrozen(minter);
  }

  function recordSuccessfulMint(address minter) external onlyIfWhitelisted(msg.sender) returns (bool) {
    frozenTil[minter] = block.timestamp.add(freezeWindow);
    return true;
  }

  /**
   * @dev Internal function for checking is an account is frozen out yet
   */
  function _isFrozen(address account) internal view returns (bool) {
    return (block.timestamp < frozenTil[account]);
  }

  /**
   * @dev Sets freeze window
   * @dev Only callable from owner
   */
  function setFreezeWindow(uint256 _freezeWindow) onlyIfWhitelisted(msg.sender) public {
    freezeWindow = _freezeWindow;
  }

  /**
   * @dev Allows for the ability to extract stuck ether
   * @dev Only callable from owner
   */
  function withdrawStuckEther(address _withdrawalAccount) onlyIfWhitelisted(msg.sender) public {
    require(_withdrawalAccount != address(0), "Invalid address provided");
    _withdrawalAccount.transfer(address(this).balance);
  }
}
