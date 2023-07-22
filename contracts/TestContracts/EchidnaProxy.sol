// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../TroveManager.sol";
import "../BorrowerOperations.sol";
import "../StabilityPool.sol";
import "../USDEToken.sol";

contract EchidnaProxy {
    TroveManager troveManager;
    BorrowerOperations borrowerOperations;
    StabilityPool stabilityPool;
    USDEToken usdeToken;

    constructor(
        TroveManager _troveManager,
        BorrowerOperations _borrowerOperations,
        StabilityPool _stabilityPool,
        USDEToken _usdeToken
    ) {
        troveManager = _troveManager;
        borrowerOperations = _borrowerOperations;
        stabilityPool = _stabilityPool;
        usdeToken = _usdeToken;
    }

    receive() external payable {
        // do nothing
    }

    // TroveManager

    function liquidatePrx(address _user) external {
        troveManager.liquidate(_user);
    }

    function liquidateTrovesPrx(uint256 _n) external {
        troveManager.liquidateTroves(_n);
    }

    function batchLiquidateTrovesPrx(address[] calldata _troveArray) external {
        troveManager.batchLiquidateTroves(_troveArray);
    }

    function redeemCollateralPrx(
        uint256 _USDEAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFee
    ) external {
        troveManager.redeemCollateral(
            _USDEAmount,
            _firstRedemptionHint,
            _upperPartialRedemptionHint,
            _lowerPartialRedemptionHint,
            _partialRedemptionHintNICR,
            _maxIterations,
            _maxFee
        );
    }

    // Borrower Operations
    function openTrovePrx(
        uint256 _ETH,
        uint256 _maxFeePercentage,
        uint256 _USDEAmount,
        address _upperHint,
        address _lowerHint,
        address[] memory _colls,
        uint256[] memory _amounts
    ) external payable {
        borrowerOperations.openTrove{value: _ETH}(
            _colls,
            _amounts,
            _maxFeePercentage,
            _USDEAmount,
            _upperHint,
            _lowerHint
        );
    }

    function addCollPrx(
        uint256 _ETH,
        address[] memory _collsIn,
        uint256[] memory _amountsIn,
        address _upperHint,
        address _lowerHint
    ) external payable {
        borrowerOperations.addColl{value: _ETH}(
            _collsIn,
            _amountsIn,
            _upperHint,
            _lowerHint
        );
    }

    function withdrawCollPrx(
        address[] memory _collsOut,
        uint256[] memory _amountsOut,
        address _upperHint,
        address _lowerHint
    ) external {
        borrowerOperations.withdrawColl(
            _collsOut,
            _amountsOut,
            _upperHint,
            _lowerHint
        );
    }

    function withdrawUSDEPrx(
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFee
    ) external {
        borrowerOperations.withdrawUSDE(
            _amount,
            _upperHint,
            _lowerHint,
            _maxFee
        );
    }

    function repayUSDEPrx(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        borrowerOperations.repayUSDE(_amount, _upperHint, _lowerHint);
    }

    function closeTrovePrx() external {
        borrowerOperations.closeTrove();
    }

    function adjustTrovePrx(
        uint256 _ETH,
        address[] memory _collsIn,
        uint256[] memory _amountsIn,
        address[] memory _collsOut,
        uint256[] memory _amountsOut,
        uint256 _USDEChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFeePercentage
    ) external {
        borrowerOperations.adjustTrove{value: _ETH}(
            _collsIn,
            _amountsIn,
            _collsOut,
            _amountsOut,
            _maxFeePercentage,
            _USDEChange,
            _isDebtIncrease,
            _upperHint,
            _lowerHint
        );
    }

    // Pool Manager
    function provideToSPPrx(uint256 _amount, address _frontEndTag) external {
        stabilityPool.provideToSP(_amount, _frontEndTag);
    }

    function withdrawFromSPPrx(uint256 _amount) external {
        stabilityPool.withdrawFromSP(_amount);
    }

    // USDE Token

    function transferPrx(
        address recipient,
        uint256 amount
    ) external returns (bool) {
        return usdeToken.transfer(recipient, amount);
    }

    function approvePrx(
        address spender,
        uint256 amount
    ) external returns (bool) {
        return usdeToken.increaseAllowance(spender, amount);
    }

    function transferFromPrx(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool) {
        return usdeToken.transferFrom(sender, recipient, amount);
    }

    function increaseAllowancePrx(
        address spender,
        uint256 addedValue
    ) external returns (bool) {
        require(usdeToken.approve(spender, 0));
        return usdeToken.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowancePrx(
        address spender,
        uint256 subtractedValue
    ) external returns (bool) {
        return usdeToken.decreaseAllowance(spender, subtractedValue);
    }
}
