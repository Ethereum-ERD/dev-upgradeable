// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TreasuryV2 is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    string public constant NAME = "Treasury";

    function initialize() public initializer {
        __Ownable_init();
    }

    function transferETH(address _to, uint256 _amount) external onlyOwner {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Treasury: sending ETH failed");
    }

    function transferERC20(
        address _to,
        address _token,
        uint256 _amount
    ) external onlyOwner {
        IERC20Upgradeable(_token).transfer(_to, _amount);
    }

    function version() public pure returns (string memory) {
        return "V2";
    }

    // --- Fallback function ---
    receive() external payable {}
}
