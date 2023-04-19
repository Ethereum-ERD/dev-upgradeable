// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface ICommunityIssuance {
    function issue() external returns (uint256);

    function trigger(address _account, uint256 _amount) external;
}
