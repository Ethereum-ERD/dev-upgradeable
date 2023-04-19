// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./TroveManagerDataTypes.sol";
import "./DataTypes.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/ICollateralManager.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IAdjust.sol";

contract CollateralManager is
    OwnableUpgradeable,
    TroveManagerDataTypes,
    ICollateralManager
{
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address;

    // During bootsrap period redemptions are not allowed
    uint256 public BOOTSTRAP_PERIOD;

    // Minimum collateral ratio for individual troves
    uint256 public MCR;

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, Recovery Mode is triggered.
    uint256 public CCR;

    // Amount of EUSD to be locked in gas pool on opening troves
    uint256 public EUSD_GAS_COMPENSATION;

    // Minimum amount of net EUSD debt a trove must have
    uint256 public MIN_NET_DEBT;

    uint256 public BORROWING_FEE_FLOOR;

    uint256 public REDEMPTION_FEE_FLOOR;
    uint256 public RECOVERY_FEE;
    uint256 public MAX_BORROWING_FEE;

    address public borrowerOperationsAddress;
    address public wethAddress;

    ITroveManager internal troveManager;

    mapping(address => DataTypes.CollateralParams) public collateralParams;

    // The array of collaterals that support,
    // index 0 represents the highest priority,
    // the lowest priority collateral in the same trove will be prioritized for liquidation or redemption
    address[] public collateralSupport;

    uint256 public collateralsCount;

    function initialize() public initializer {
        __Ownable_init();
        BOOTSTRAP_PERIOD = 14 days;
        MCR = 1100000000000000000; // 110%
        CCR = 1300000000000000000; // 130%
        EUSD_GAS_COMPENSATION = 200e18;
        MIN_NET_DEBT = 1800e18;
        BORROWING_FEE_FLOOR = (DECIMAL_PRECISION / 10000) * 75; // 0.75%

        REDEMPTION_FEE_FLOOR = (DECIMAL_PRECISION / 10000) * 75; // 0.75%
        RECOVERY_FEE = (DECIMAL_PRECISION / 10000) * 25; // 0.25%
        MAX_BORROWING_FEE = (DECIMAL_PRECISION / 100) * 5; // 5%
    }

    function setAddresses(
        address _borrowerOperationsAddress,
        address _priceFeedAddress,
        address _troveManagerAddress,
        address _wethAddress
    ) external override onlyOwner {
        _requireIsContract(_borrowerOperationsAddress);
        _requireIsContract(_priceFeedAddress);
        _requireIsContract(_wethAddress);
        _requireIsContract(_troveManagerAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;
        priceFeed = IPriceFeed(_priceFeedAddress);
        wethAddress = _wethAddress;

        // collateralSupport.push(_wethAddress);
        // collateralsCount = collateralsCount.add(1);

        troveManager = ITroveManager(_troveManagerAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit WETHAddressChanged(_wethAddress);
    }

    function addCollateral(
        address _collateral,
        address _oracle
    ) external override onlyOwner {
        _requireCollNotExist(_collateral);
        setOracle(_collateral, _oracle);
        _setStatus(_collateral, 1);
        collateralParams[_collateral].index = collateralsCount;
        collateralSupport.push(_collateral);
        collateralsCount = collateralsCount.add(1);
    }

    function removeCollateral(address _collateral) external override onlyOwner {
        address collAddress = _collateral;
        _requireCollIsPaused(collAddress);
        require(
            collateralsCount > 1,
            "CollateralManager: Need at least one collateral support"
        );
        uint256 index = getIndex(collAddress);
        address collateral;
        for (uint256 i = index; i < collateralsCount - 1; ) {
            collateral = collateralSupport[i];
            collateralSupport[i] = collateralSupport[i + 1];
            collateralSupport[i + 1] = collateral;
            collateralParams[collateralSupport[i]].index = i;
            unchecked {
                i++;
            }
        }
        collateralSupport.pop();
        collateralsCount = collateralsCount.sub(1);
        delete collateralParams[collAddress];
    }

    function setCollateralPriority(
        address _collateral,
        uint256 _newIndex
    ) external override onlyOwner {
        _requireCollIsActive(_collateral);
        uint256 oldIndex = getIndex(_collateral);
        uint256 newIndex = _newIndex;
        assert(newIndex != oldIndex && newIndex < collateralsCount);
        if (newIndex < oldIndex) {
            uint256 tmpIndex = oldIndex;
            uint256 gap = oldIndex - newIndex;
            for (uint256 i = 0; i < gap; ) {
                tmpIndex = _up(tmpIndex);
                unchecked {
                    i++;
                }
            }
        } else {
            uint256 tmpIndex = newIndex;
            uint256 gap = oldIndex - newIndex;
            for (uint256 i = 0; i < gap; ) {
                tmpIndex = _down(tmpIndex);
                unchecked {
                    i++;
                }
            }
        }
        collateralParams[_collateral].index = _newIndex;
    }

    function _up(uint256 _index) internal returns (uint256) {
        uint256 index = _index;
        _swap(index, index - 1);
        return index - 1;
    }

    function _down(uint256 _index) internal returns (uint256) {
        uint256 index = _index;
        _swap(index, index + 1);
        return index + 1;
    }

    function _swap(uint256 _x, uint256 _y) internal {
        address collateral = collateralSupport[_x];
        collateralSupport[_y] = collateralSupport[_x];
        collateralSupport[_x] = collateral;
    }

    function pauseCollateral(address _collateral) external override onlyOwner {
        _setStatus(_collateral, 2);
    }

    function activeCollateral(address _collateral) external override onlyOwner {
        _setStatus(_collateral, 1);
    }

    function _setStatus(address _collateral, uint256 _num) internal {
        collateralParams[_collateral].status = DataTypes.CollStatus(_num);
    }

    function setOracle(
        address _collateral,
        address _oracle
    ) public override onlyOwner {
        collateralParams[_collateral].oracle = _oracle;
    }

    function priceUpdate() external override {
        if (collateralsCount < 2) {
            return;
        }
        for (uint256 i = 1; i < collateralsCount; ) {
            IAdjust(collateralParams[collateralSupport[i]].oracle).fetchPrice();
            unchecked {
                i++;
            }
        }
    }

    function getValue(
        address[] memory _collaterals,
        uint256[] memory _amounts
    )
        public
        view
        override
        returns (uint256 totalValue, uint256[] memory values)
    {
        uint256 price = priceFeed.fetchPrice_view();
        return getValue(_collaterals, _amounts, price);
    }

    function getValue(
        address[] memory _collaterals,
        uint256[] memory _amounts,
        uint256 _price
    )
        public
        view
        override
        returns (uint256 totalValue, uint256[] memory values)
    {
        uint256 price = _price;
        uint256 collLen = _collaterals.length;
        require(collLen == _amounts.length, "Length mismatch");
        values = new uint256[](collLen);
        address collateral;
        uint256 amount;
        for (uint256 i = 0; i < collLen; ) {
            collateral = _collaterals[i];
            amount = _amounts[i];
            if (amount != 0) {
                if (collateral != wethAddress) {
                    IAdjust coll_adjust = IAdjust(
                        collateralParams[collateral].oracle
                    );
                    uint256 value = coll_adjust
                        .fetchPrice_view()
                        .mul(amount)
                        .div(DECIMAL_PRECISION)
                        .mul(price)
                        .div(DECIMAL_PRECISION);
                    totalValue = totalValue.add(value);
                    values[i] = value;
                } else {
                    uint256 value = amount.mul(price).div(DECIMAL_PRECISION);
                    totalValue = totalValue.add(value);
                    values[i] = value;
                }
            }

            unchecked {
                i++;
            }
        }
    }

    function getTotalValue(
        address[] memory _collaterals,
        uint256[] memory _amounts
    ) public view override returns (uint256 totalValue) {
        (totalValue, ) = getValue(
            _collaterals,
            _amounts,
            priceFeed.fetchPrice_view()
        );
    }

    function adjustIn(
        address[] memory _collaterals,
        uint256[] memory _amounts
    ) public view override returns (uint256[] memory) {
        uint256 collLen = _collaterals.length;
        uint256[] memory amounts = new uint256[](collLen);
        for (uint256 i = 0; i < collLen; ) {
            if (_collaterals[i] != wethAddress) {
                amounts[i] = adjustIn(_collaterals[i], _amounts[i]);
            } else {
                amounts[i] = _amounts[i];
            }
            unchecked {
                i++;
            }
        }
        return amounts;
    }

    function adjustIn(
        address _collateral,
        uint256 _amount
    ) public view override returns (uint256) {
        IAdjust coll_adjust = IAdjust(collateralParams[_collateral].oracle);
        return coll_adjust.adjustIn(_amount);
    }

    function adjustOut(
        address[] memory _collaterals,
        uint256[] memory _amounts
    ) public view override returns (uint256[] memory) {
        uint256 collLen = _collaterals.length;
        uint256[] memory amounts = new uint256[](collLen);
        for (uint256 i = 0; i < collLen; ) {
            if (_collaterals[i] != wethAddress) {
                amounts[i] = adjustOut(_collaterals[i], _amounts[i]);
            } else {
                amounts[i] = _amounts[i];
            }
            unchecked {
                i++;
            }
        }
        return amounts;
    }

    function adjustOut(
        address _collateral,
        uint256 _amount
    ) public view override returns (uint256) {
        IAdjust coll_adjust = IAdjust(collateralParams[_collateral].oracle);
        return coll_adjust.adjustOut(_amount);
    }

    // --- Getters ---
    function getCollateralSupport()
        external
        view
        override
        returns (address[] memory)
    {
        return collateralSupport;
    }

    function getIsActive(
        address _collateral
    ) public view override returns (bool) {
        return (uint256(collateralParams[_collateral].status)) == 1;
    }

    function getIsSupport(
        address _collateral
    ) public view override returns (bool) {
        return (uint256(collateralParams[_collateral].status)) != 0;
    }

    function getCollateralOracle(
        address _collateral
    ) external view override returns (address) {
        return collateralParams[_collateral].oracle;
    }

    function getCollateralOracles()
        external
        view
        override
        returns (address[] memory)
    {
        address[] memory oracles = new address[](collateralsCount);
        for (uint256 i = 0; i < collateralsCount; ) {
            oracles[i] = collateralParams[collateralSupport[i]].oracle;
            unchecked {
                i++;
            }
        }
        return oracles;
    }

    function getCollateralParams(
        address _collateral
    ) external view override returns (DataTypes.CollateralParams memory) {
        return collateralParams[_collateral];
    }

    function getCollateralsAmount() external view override returns (uint256) {
        return collateralsCount;
    }

    function getIndex(
        address _collateral
    ) public view override returns (uint256) {
        require(
            getIsSupport(_collateral),
            "CollateralManager: Collateral not support"
        );
        return collateralParams[_collateral].index;
    }

    // --- 'require' wrapper functions ---

    function _requireIsContract(address _contract) internal view {
        require(
            _contract.isContract(),
            "CollateralManager: Contract check error"
        );
    }

    function _requireCollNotExist(address _collateral) internal view {
        require(
            !getIsSupport(_collateral),
            "CollateralManager: Collateral already exists"
        );
    }

    function _requireCollIsActive(address _collateral) internal view {
        require(
            getIsActive(_collateral),
            "CollateralManager: Collateral not pause"
        );
    }

    function _requireCollIsPaused(address _collateral) internal view {
        require(
            getIsSupport(_collateral) && !getIsActive(_collateral),
            "CollateralManager: Collateral not pause"
        );
    }

    function adjustColls(
        uint256[] memory _initialAmounts,
        address[] memory _collsIn,
        uint256[] memory _amountsIn,
        address[] memory _collsOut,
        uint256[] memory _amountsOut
    ) external view override returns (uint256[] memory newAmounts) {
        newAmounts = ERDMath._getArrayCopy(_initialAmounts);
        uint256 collsInLen = _collsIn.length;
        uint256 collsOutLen = _collsOut.length;
        for (uint256 i = 0; i < collsInLen; i++) {
            uint256 idx = getIndex(_collsIn[i]);
            newAmounts[idx] = newAmounts[idx].add(_amountsIn[i]);
        }

        for (uint256 i = 0; i < collsOutLen; i++) {
            uint256 idx = getIndex(_collsOut[i]);
            newAmounts[idx] = newAmounts[idx].sub(_amountsOut[i]);
        }
    }

    // --- Config update functions ---

    function setMCR(uint256 _mcr) external override onlyOwner {
        MCR = _mcr;
    }

    function setCCR(uint256 _ccr) external override onlyOwner {
        CCR = _ccr;
    }

    function setGasCompensation(uint256 _gas) external override onlyOwner {
        EUSD_GAS_COMPENSATION = _gas;
    }

    function setMinDebt(uint256 _minDebt) external override onlyOwner {
        MIN_NET_DEBT = _minDebt;
    }

    function setBorrowingFeeFloor(
        uint256 _borrowingFloor
    ) external override onlyOwner {
        BORROWING_FEE_FLOOR = _borrowingFloor;
    }

    function setRedemptionFeeFloor(
        uint256 _redemptionFloor
    ) external override onlyOwner {
        REDEMPTION_FEE_FLOOR = _redemptionFloor;
    }

    function setRecoveryFee(
        uint256 _redemptionFloor
    ) external override onlyOwner {
        RECOVERY_FEE = _redemptionFloor;
    }

    function setMaxBorrowingFee(
        uint256 _maxBorrowingFee
    ) external override onlyOwner {
        MAX_BORROWING_FEE = _maxBorrowingFee;
    }

    function setBootstrapPeriod(uint256 _period) external override onlyOwner {
        BOOTSTRAP_PERIOD = _period;
    }

    function getCCR() external view override returns (uint256) {
        return CCR;
    }

    function getMCR() external view override returns (uint256) {
        return MCR;
    }

    function getEUSDGasCompensation() external view override returns (uint256) {
        return EUSD_GAS_COMPENSATION;
    }

    function getMinNetDebt() external view override returns (uint256) {
        return MIN_NET_DEBT;
    }

    function getMaxBorrowingFee() external view override returns (uint256) {
        return MAX_BORROWING_FEE;
    }

    function getBorrowingFeeFloor() external view override returns (uint256) {
        return BORROWING_FEE_FLOOR;
    }

    function getRedemptionFeeFloor() external view override returns (uint256) {
        return REDEMPTION_FEE_FLOOR;
    }

    function getRecoveryFee() external view override returns (uint256) {
        return RECOVERY_FEE;
    }

    function getBootstrapPeriod() external view override returns (uint256) {
        return BOOTSTRAP_PERIOD;
    }
}
