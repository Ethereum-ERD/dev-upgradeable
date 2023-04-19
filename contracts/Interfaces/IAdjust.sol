// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IAdjust {
    // --- Function ---
    function adjustIn(uint256 _amount) external view returns (uint256);

    function adjustOut(uint256 _amount) external view returns (uint256);

    function fetchPrice() external returns (uint256);

    function fetchPrice_view() external view returns (uint256);
}
