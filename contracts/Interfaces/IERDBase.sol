// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./IPriceFeed.sol";

interface IERDBase {
    function priceFeed() external view returns (IPriceFeed);
}
