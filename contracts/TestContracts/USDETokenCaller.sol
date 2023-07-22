// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../Interfaces/IUSDEToken.sol";

contract USDETokenCaller {
    IUSDEToken USDE;

    function setUSDE(IUSDEToken _USDE) external {
        USDE = _USDE;
    }

    function usdeMint(address _account, uint256 _amount) external {
        USDE.mint(_account, _amount);
    }

    function usdeBurn(address _account, uint256 _amount) external {
        USDE.burn(_account, _amount);
    }

    function usdeSendToPool(
        address _sender,
        address _poolAddress,
        uint256 _amount
    ) external {
        USDE.sendToPool(_sender, _poolAddress, _amount);
    }

    function usdeReturnFromPool(
        address _poolAddress,
        address _receiver,
        uint256 _amount
    ) external {
        USDE.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
