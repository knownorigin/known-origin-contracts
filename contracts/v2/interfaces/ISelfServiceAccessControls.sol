pragma solidity 0.4.24;

interface ISelfServiceAccessControls {

  function isEnabledForAccount(address account) public view returns (bool);

}
