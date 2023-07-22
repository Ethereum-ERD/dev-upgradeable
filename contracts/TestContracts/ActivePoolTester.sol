// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    using SafeMathUpgradeable for uint256;

    function unprotectedIncreaseUSDEDebt(uint256 _amount) external {
        USDEDebt = USDEDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        // @KingYet: Commented
        // ETH = ETH.add(msg.value);
    }
}
