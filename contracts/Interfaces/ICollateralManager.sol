// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../DataTypes.sol";

interface ICollateralManager {
    function setAddresses(
        address _borrowerOperationsAddress,
        address _priceFeedAddress,
        address _troveManagerAddress,
        address _wethAddress
    ) external;

    function addCollateral(address _collateral, address _oracle) external;

    function removeCollateral(address _collateral) external;

    function setCollateralPriority(address _collateral, uint256 _newIndex)
        external;

    function pauseCollateral(address _collateral) external;

    function activeCollateral(address _collateral) external;

    function setOracle(address _collateral, address _oracle) external;

    function priceUpdate() external;

    function adjustIn(address[] memory _collaterals, uint256[] memory _amounts)
        external
        view
        returns (uint256[] memory);

    function adjustIn(address _collateral, uint256 _amount)
        external
        view
        returns (uint256);

    function adjustOut(address[] memory _collaterals, uint256[] memory _amounts)
        external
        view
        returns (uint256[] memory);

    function adjustOut(address _collateral, uint256 _amount)
        external
        view
        returns (uint256);
    
    function adjustColls(
        uint256[] memory _initialAmounts,
        address[] memory _collsIn,
        uint256[] memory _amountsIn,
        address[] memory _collsOut,
        uint256[] memory _amountsOut
    ) external view returns (uint256[] memory newAmounts);

    function getCollateralSupport() external view returns (address[] memory);

    function getIsActive(address _collateral)
        external
        view
        returns (bool);

    function getIsSupport(address _collateral)
        external
        view
        returns (bool);

    function getCollateralOracle(address _collateral)
        external
        view
        returns (address);

    function getCollateralOracles() external view returns (address[] memory);

    function getCollateralParams(address _collateral)
        external
        view
        returns (DataTypes.CollateralParams memory);

    function getCollateralsAmount() external view returns (uint256);

    function getValue(
        address[] memory _collaterals,
        uint256[] memory _amounts
    ) external view returns (uint256, uint256[] memory);

    function getValue(
        address[] memory _collaterals,
        uint256[] memory _amounts,
        uint256 _price
    ) external view returns (uint256, uint256[] memory);

    function getTotalValue(
        address[] memory _collaterals,
        uint256[] memory _amounts
    ) external view returns (uint256);

    function setMCR(uint256 _mcr) external;

    function setCCR(uint256 _ccr) external;

    function setGasCompensation(uint256 _gas) external;

    function setMinDebt(uint256 _minDebt) external;

    function setBorrowingFeeFloor(uint256 _borrowingFloor) external;

    function setRedemptionFeeFloor(uint256 _redemptionFloor) external;

    function setRecoveryFee(uint256 _redemptionFloor) external;

    function setMaxBorrowingFee(uint256 _maxBorrowingFee) external;

    function setBootstrapPeriod(uint256 _period) external;

    function getMCR() external view returns (uint256);

    function getCCR() external view returns (uint256);

    function getEUSDGasCompensation() external view returns (uint256);

    function getMinNetDebt() external view returns (uint256);

    function getMaxBorrowingFee() external view returns (uint256);

    function getBorrowingFeeFloor() external view returns (uint256);

    function getRedemptionFeeFloor() external view returns (uint256);

    function getRecoveryFee() external view returns (uint256);

    function getBootstrapPeriod() external view returns (uint256);

    function getIndex(address _collateral) external view returns (uint256);
}
