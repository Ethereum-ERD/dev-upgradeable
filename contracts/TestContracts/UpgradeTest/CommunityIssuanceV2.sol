// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../Interfaces/ICommunityIssuance.sol";

contract CommunityIssuanceV2 is OwnableUpgradeable, ICommunityIssuance {
    function initialize() public initializer {
        __Ownable_init();
    }

    function issue() external override returns (uint256) {
        return 0;
    }

    function trigger(address _account, uint256 _amount) external override {
        return;
    }

    function version() public pure returns (string memory) {
        return "V2";
    }
}
