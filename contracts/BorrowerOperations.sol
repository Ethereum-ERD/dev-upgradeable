// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/IWETH.sol";
import "./Dependencies/ERDBase.sol";
import "./Errors.sol";

contract BorrowerOperations is
    ERDBase,
    OwnableUpgradeable,
    IBorrowerOperations,
    ReentrancyGuardUpgradeable
{
    string public constant NAME = "BorrowerOperations";

    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address;

    // --- Connected contract declarations ---

    ITroveManager public troveManager;

    IWETH public WETH;

    address stabilityPoolAddress;

    ICollSurplusPool collSurplusPool;

    address public treasuryAddress;

    // A doubly linked list of Troves, sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    bool internal paused;

    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

    struct AdjustTrove_Params {
        address borrower;
        address[] collsIn;
        uint256[] amountsIn;
        uint256[] sharesIn;
        address[] collsOut;
        uint256[] amountsOut;
        uint256[] sharesOut;
        uint256 USDEChange;
        bool isDebtIncrease;
        address upperHint;
        address lowerHint;
        uint256 maxFeePercentage;
    }

    struct LocalVariables_adjustTrove {
        uint256 price;
        uint256 collChange;
        uint256 netDebtChange;
        bool isCollIncrease;
        uint256 debt;
        uint256[] colls;
        uint256[] shares;
        uint256[] newShares;
        uint256 oldICR;
        uint256 newICR;
        uint256 newTCR;
        uint256 USDEFee;
        uint256 newDebt;
        uint256 valueIn;
        uint256 valueOut;
        uint256 currValue;
        uint256 newValue;
        address[] collaterals;
    }

    struct LocalVariables_openTrove {
        uint256 price;
        uint256 USDEFee;
        uint256 netShare;
        uint256 netDebt;
        uint256 compositeDebt;
        uint256 ICR;
        uint256 value;
        uint256 arrayIndex;
        address[] collaterals;
        uint256[] netColls;
        uint256[] netShares;
    }

    // --- Dependency setters ---
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
    }

    function setAddresses(
        address _troveManagerAddress,
        address _collateralManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedTrovesAddress,
        address _usdeTokenAddress
    ) external override onlyOwner {
        _requireIsContract(_troveManagerAddress);
        _requireIsContract(_collateralManagerAddress);
        _requireIsContract(_activePoolAddress);
        _requireIsContract(_defaultPoolAddress);
        _requireIsContract(_stabilityPoolAddress);
        _requireIsContract(_gasPoolAddress);
        _requireIsContract(_collSurplusPoolAddress);
        _requireIsContract(_priceFeedAddress);
        _requireIsContract(_sortedTrovesAddress);
        _requireIsContract(_usdeTokenAddress);

        troveManager = ITroveManager(_troveManagerAddress);
        collateralManager = ICollateralManager(_collateralManagerAddress);
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPoolAddress = _stabilityPoolAddress;
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        usdeToken = IUSDEToken(_usdeTokenAddress);

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit CollateralManagerAddressChanged(_collateralManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit USDETokenAddressChanged(_usdeTokenAddress);
    }

    function init(
        address _wethAddress,
        address _treasuryAddress,
        address _troveDebtAddress
    ) external onlyOwner {
        _requireIsContract(_wethAddress);
        _requireIsContract(_treasuryAddress);
        _requireIsContract(_troveDebtAddress);

        WETH = IWETH(_wethAddress);
        treasuryAddress = _treasuryAddress;
        troveDebt = ITroveDebt(_troveDebtAddress);

        emit WETHAddressChanged(_wethAddress);
        emit TreasuryAddressChanged(_treasuryAddress);
        emit TroveDebtAddressChanged(_troveDebtAddress);
    }

    // --- Borrower Trove Operations ---

    function openTrove(
        address[] memory _colls,
        uint256[] memory _amounts,
        uint256 _maxFeePercentage,
        uint256 _USDEAmount,
        address _upperHint,
        address _lowerHint,
        address _referrer
    ) external payable override nonReentrant {
        _requireNotPaused();
        _requireValidOpenTroveCollateral(_colls, _amounts, msg.value);

        LocalVariables_openTrove memory vars;
        (vars.collaterals, vars.netColls) = _adjustArray(
            _colls,
            _amounts,
            msg.value
        );

        _activePoolAddColl(msg.sender, vars.collaterals, vars.netColls);

        ContractsCache memory contractsCache = ContractsCache(
            troveManager,
            collateralManager,
            activePool,
            usdeToken
        );

        // Update all collateral price
        vars.price = priceFeed.fetchPrice();
        contractsCache.collateralManager.priceUpdate();
        (vars.netShares, vars.value) = contractsCache
            .collateralManager
            .mintEToken(
                vars.collaterals,
                vars.netColls,
                msg.sender,
                vars.price
            );

        require(
            contractsCache.troveManager.getTroveStatus(msg.sender) != 1,
            Errors.BO_TROVE_ACTIVE
        );

        bool isRecoveryMode = contractsCache.troveManager.checkRecoveryMode(
            vars.price
        );

        _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);

        vars.USDEFee;
        vars.netDebt = _USDEAmount;

        // Different borrowing fee for different mode
        vars.USDEFee = _triggerBorrowingFee(
            contractsCache.troveManager,
            contractsCache.usdeToken,
            _USDEAmount,
            _maxFeePercentage,
            isRecoveryMode
        );
        vars.netDebt = vars.netDebt.add(vars.USDEFee);
        _requireAtLeastMinNetDebt(vars.netDebt);

        // ICR is based on the composite debt, i.e. the requested USDE amount + USDE borrowing fee + USDE gas comp.
        uint256 gas = USDE_GAS_COMPENSATION();
        vars.compositeDebt = _getCompositeDebt(vars.netDebt, gas);
        assert(vars.compositeDebt > 0);

        vars.ICR = ERDMath._computeCR(vars.value, vars.compositeDebt);

        if (isRecoveryMode) {
            _requireICRisAboveCCR(vars.ICR);
        } else {
            _requireICRisAboveMCR(vars.ICR);
            // collateral already transfer to activePool
            // pass collChange = 0 to function
            uint256 newTCR = _getNewTCRFromTroveChange(
                vars.compositeDebt,
                true,
                vars.price
            ); // bools: coll increase, debt increase

            _requireNewTCRisAboveCCR(newTCR);
        }
        // Set the trove struct's properties
        contractsCache.troveManager.setTroveStatus(msg.sender, 1);

        contractsCache.troveManager.increaseTroveDebt(msg.sender, vars.netDebt);
        contractsCache.troveManager.updateTroveRewardSnapshots(msg.sender);
        contractsCache.troveManager.updateStakeAndTotalStakes(msg.sender);

        sortedTroves.insert(msg.sender, vars.ICR, _upperHint, _lowerHint);
        vars.arrayIndex = contractsCache.troveManager.addTroveOwnerToArray(
            msg.sender
        );
        emit TroveCreated(msg.sender, vars.arrayIndex);

        // Move the collateral to the Active Pool, and mint the USDEAmount to the borrower
        _withdrawUSDE(
            contractsCache.activePool,
            contractsCache.usdeToken,
            msg.sender,
            _USDEAmount,
            vars.netDebt
        );
        // Move the USDE gas compensation to the Gas Pool
        _withdrawUSDE(
            contractsCache.activePool,
            contractsCache.usdeToken,
            gasPoolAddress,
            gas,
            gas
        );

        emit TroveUpdated(
            msg.sender,
            vars.compositeDebt,
            vars.collaterals,
            vars.netShares,
            vars.netColls,
            BorrowerOperation.openTrove
        );
        emit USDEBorrowingFeePaid(msg.sender, vars.USDEFee);
        emit Referrer(
            _referrer,
            msg.sender,
            vars.collaterals,
            vars.netColls,
            vars.compositeDebt
        );
    }

    function _adjustArray(
        address[] memory _collaterals,
        uint256[] memory _amounts,
        uint256 _amount
    ) public view returns (address[] memory, uint256[] memory) {
        uint256 collLen = _collaterals.length;
        if (_amount == 0) {
            return (_collaterals, _amounts);
        } else {
            if (collLen == 0) {
                address[] memory collaterals = new address[](1);
                uint256[] memory amounts = new uint256[](1);
                collaterals[0] = address(WETH);
                amounts[0] = _amount;
                return (collaterals, amounts);
            } else {
                address[] memory collaterals = new address[](collLen + 1);
                uint256[] memory amounts = new uint256[](collLen + 1);
                collaterals[0] = address(WETH);
                amounts[0] = _amount;
                address collateral;
                bool hasWETH;
                uint256 index;
                for (uint256 i = 0; i < collLen; i++) {
                    collateral = _collaterals[i];
                    if (collateral != address(WETH)) {
                        collaterals[i + 1] = collateral;
                        amounts[i + 1] = _amounts[i];
                    } else {
                        hasWETH = true;
                        index = i;
                        break;
                    }
                }
                if (hasWETH) {
                    _amounts[index] = _amounts[index].add(_amount);
                    return (_collaterals, _amounts);
                } else {
                    return (collaterals, amounts);
                }
            }
        }
    }

    // Send collateral to a trove
    function addColl(
        address[] memory _collsIn,
        uint256[] memory _amountsIn,
        address _upperHint,
        address _lowerHint
    ) external payable override nonReentrant {
        _requireNotPaused();
        AdjustTrove_Params memory params;
        params.borrower = msg.sender;
        _requireValidAdjustCollateralAmounts(
            _collsIn,
            _amountsIn,
            msg.value,
            true
        );

        (params.collsIn, params.amountsIn) = _adjustArray(
            _collsIn,
            _amountsIn,
            msg.value
        );

        _activePoolAddColl(msg.sender, params.collsIn, params.amountsIn);
        params.sharesIn = collateralManager.getShares(
            params.collsIn,
            params.amountsIn
        );
        params.upperHint = _upperHint;
        params.lowerHint = _lowerHint;
        _adjustTrove(params);
    }

    // Withdraw collateral from a trove
    function withdrawColl(
        address[] memory _collsOut,
        uint256[] memory _amountsOut,
        address _upperHint,
        address _lowerHint
    ) external override nonReentrant {
        AdjustTrove_Params memory params;
        params.borrower = msg.sender;
        params.collsOut = _collsOut;
        params.amountsOut = _amountsOut;
        params.upperHint = _upperHint;
        params.lowerHint = _lowerHint;

        _requireValidAdjustCollateralAmounts(
            params.collsOut,
            params.amountsOut,
            0,
            false
        );
        params.sharesOut = collateralManager.getShares(
            params.collsOut,
            params.amountsOut
        );

        _adjustTrove(params);
    }

    // Withdraw USDE tokens from a trove: mint new USDE tokens to the owner, and increase the trove's debt accordingly
    function withdrawUSDE(
        uint256 _USDEAmount,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFeePercentage
    ) external override nonReentrant {
        AdjustTrove_Params memory params;
        params.borrower = msg.sender;
        params.USDEChange = _USDEAmount;
        params.maxFeePercentage = _maxFeePercentage;
        params.upperHint = _upperHint;
        params.lowerHint = _lowerHint;
        params.isDebtIncrease = true;
        _adjustTrove(params);
    }

    // Repay USDE tokens to a Trove: Burn the repaid USDE tokens, and reduce the trove's debt accordingly
    function repayUSDE(
        uint256 _USDEAmount,
        address _upperHint,
        address _lowerHint
    ) external override nonReentrant {
        AdjustTrove_Params memory params;
        params.borrower = msg.sender;
        params.USDEChange = _USDEAmount;
        params.upperHint = _upperHint;
        params.lowerHint = _lowerHint;
        params.isDebtIncrease = false;
        _adjustTrove(params);
    }

    // Send collateral to a trove. Called by only the Stability Pool.
    function moveCollGainToTrove(
        address _borrower,
        address[] memory _collsIn,
        uint256[] memory _amountsIn,
        address _upperHint,
        address _lowerHint
    ) external override nonReentrant {
        require(msg.sender == stabilityPoolAddress, Errors.CALLER_NOT_SP);
        AdjustTrove_Params memory params;
        params.borrower = _borrower;
        (params.collsIn, params.amountsIn) = _removeZero(_collsIn, _amountsIn);
        params.upperHint = _upperHint;
        params.lowerHint = _lowerHint;

        _requireValidAdjustCollateralAmounts(
            params.collsIn,
            params.amountsIn,
            0,
            true
        );
        params.sharesIn = collateralManager.getShares(
            params.collsIn,
            params.amountsIn
        );

        _activePoolAddColl(msg.sender, params.collsIn, params.amountsIn);

        _adjustTrove(params);
    }

    function adjustTrove(
        address[] memory _collsIn,
        uint256[] memory _amountsIn,
        address[] memory _collsOut,
        uint256[] memory _amountsOut,
        uint256 _maxFeePercentage,
        uint256 _USDEChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint
    ) external payable override nonReentrant {
        _requireNoOverlapColls(_collsIn, _collsOut);
        _requireValidAdjustCollateralAmounts(
            _collsIn,
            _amountsIn,
            msg.value,
            true
        );
        _requireValidAdjustCollateralAmounts(
            _collsOut,
            _amountsOut,
            msg.value,
            false
        );

        (
            address[] memory adjustCollsIn,
            uint256[] memory adjustAmountsIn
        ) = _adjustArray(_collsIn, _amountsIn, msg.value);

        uint256[] memory adjustSharesIn = collateralManager.getShares(
            adjustCollsIn,
            adjustAmountsIn
        );
        uint256[] memory adjustSharesOut = collateralManager.getShares(
            _collsOut,
            _amountsOut
        );

        _activePoolAddColl(msg.sender, adjustCollsIn, adjustAmountsIn);
        AdjustTrove_Params memory params = AdjustTrove_Params({
            borrower: msg.sender,
            collsIn: adjustCollsIn,
            amountsIn: adjustAmountsIn,
            sharesIn: adjustSharesIn,
            collsOut: _collsOut,
            amountsOut: _amountsOut,
            sharesOut: adjustSharesOut,
            USDEChange: _USDEChange,
            isDebtIncrease: _isDebtIncrease,
            upperHint: _upperHint,
            lowerHint: _lowerHint,
            maxFeePercentage: _maxFeePercentage
        });
        _adjustTrove(params);
    }

    /*
     * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal.
     *
     * It therefore expects either a positive msg.value, or a positive _collWithdrawal argument.
     *
     * If both are positive, it will revert.
     */
    function _adjustTrove(AdjustTrove_Params memory params) internal {
        _requireNotPaused();
        ContractsCache memory contractsCache = ContractsCache(
            troveManager,
            collateralManager,
            activePool,
            usdeToken
        );
        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();
        contractsCache.collateralManager.priceUpdate();
        bool isRecoveryMode = contractsCache.troveManager.checkRecoveryMode(
            vars.price
        );
        if (params.isDebtIncrease) {
            _requireValidMaxFeePercentage(
                params.maxFeePercentage,
                isRecoveryMode
            );
            require(params.USDEChange > 0, Errors.BO_DEBT_INCREASE_ZERO);
        }
        _requireNonZeroAdjustment(
            params.amountsIn,
            params.amountsOut,
            params.USDEChange
        );
        _requireTroveisActive(contractsCache.troveManager, params.borrower);
        // Confirm the operation is either a borrower adjusting their own trove, or a pure collateral transfer from the Stability Pool to a trove
        assert(
            msg.sender == params.borrower ||
                (msg.sender == stabilityPoolAddress &&
                    params.amountsIn.length > 0 /* TODO:  necessary? */ &&
                    params.USDEChange == 0)
        );

        contractsCache.troveManager.applyPendingRewards(params.borrower);

        (vars.colls, vars.shares, vars.collaterals) = contractsCache
            .troveManager
            .getTroveColls(params.borrower);

        (vars.currValue, ) = contractsCache.collateralManager.getValue(
            vars.collaterals,
            vars.colls,
            vars.price
        );

        (, vars.valueIn) = contractsCache.collateralManager.mintEToken(
            params.collsIn,
            params.amountsIn,
            params.borrower,
            vars.price
        );

        (, vars.valueOut) = contractsCache.collateralManager.burnEToken(
            params.collsOut,
            params.amountsOut,
            params.borrower,
            vars.price
        );

        vars.netDebtChange = params.USDEChange;

        // If the adjustment incorporates a debt increase and system is in Normal Mode, then trigger a borrowing fee
        if (params.isDebtIncrease) {
            vars.USDEFee = _triggerBorrowingFee(
                contractsCache.troveManager,
                contractsCache.usdeToken,
                params.USDEChange,
                params.maxFeePercentage,
                isRecoveryMode
            );
            vars.netDebtChange = vars.netDebtChange.add(vars.USDEFee); // The raw debt change includes the fee
        }

        vars.debt = contractsCache.troveManager.getTroveDebt(params.borrower);

        // Compute the new collateral & debt, considering the change in coll and debt. Assumes 0 pending rewards.
        vars.newValue = vars.currValue.add(vars.valueIn).sub(vars.valueOut);
        vars.newDebt = params.isDebtIncrease
            ? vars.debt.add(vars.netDebtChange)
            : vars.debt.sub(vars.netDebtChange);

        // Get the collChange based on whether or not collateral was sent in the transaction
        vars.isCollIncrease = vars.newValue > vars.currValue;
        vars.collChange = vars.isCollIncrease
            ? vars.newValue.sub(vars.currValue)
            : vars.currValue.sub(vars.newValue);

        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = ERDMath._computeCR(vars.currValue, vars.debt);
        vars.newICR = ERDMath._computeCR(vars.newValue, vars.newDebt);

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(
            isRecoveryMode,
            params.amountsOut,
            params.isDebtIncrease,
            vars
        );

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough USDE
        if (!params.isDebtIncrease && params.USDEChange > 0) {
            _requireAtLeastMinNetDebt(
                _getNetDebt(vars.debt, USDE_GAS_COMPENSATION()).sub(
                    vars.netDebtChange
                )
            );
            // _requireValidUSDERepayment(vars.debt, vars.netDebtChange);
            require(
                vars.netDebtChange <= vars.debt.sub(USDE_GAS_COMPENSATION()),
                Errors.BO_REPAID_AMOUNT_LARGER_DEBT
            );
            _requireSufficientUSDEBalance(
                contractsCache.usdeToken,
                params.borrower,
                vars.netDebtChange
            );
        }

        _updateTroveFromAdjustment(
            contractsCache.troveManager,
            params.borrower,
            vars.netDebtChange,
            params.isDebtIncrease
        );
        contractsCache.troveManager.updateStakeAndTotalStakes(params.borrower);

        // Re-insert trove in to the sorted list
        sortedTroves.reInsert(
            params.borrower,
            vars.newICR,
            params.upperHint,
            params.lowerHint
        );

        (vars.colls, vars.newShares, ) = contractsCache
            .troveManager
            .getTroveColls(params.borrower);

        emit TroveUpdated(
            params.borrower,
            vars.newDebt,
            vars.collaterals,
            vars.newShares,
            vars.colls,
            BorrowerOperation.adjustTrove
        );
        emit USDEBorrowingFeePaid(msg.sender, vars.USDEFee);

        // Use the unmodified _USDEChange here, as we don't send the fee to the user
        _moveTokensAndCollateralfromAdjustment(
            contractsCache.activePool,
            contractsCache.usdeToken,
            msg.sender,
            params.collsOut,
            params.amountsOut,
            params.USDEChange,
            params.isDebtIncrease,
            vars.netDebtChange
        );
    }

    function closeTrove() external override nonReentrant {
        _requireNotPaused();
        ITroveManager troveManagerCached = troveManager;
        ICollateralManager collateralManagerCached = collateralManager;
        IActivePool activePoolCached = activePool;
        IUSDEToken usdeTokenCached = usdeToken;

        _requireTroveisActive(troveManagerCached, msg.sender);
        uint256 price = priceFeed.fetchPrice();
        collateralManagerCached.priceUpdate();
        require(
            !troveManager.checkRecoveryMode(price),
            Errors.BO_NOT_PERMIT_IN_RECOVERY_MODE
        );

        troveManagerCached.applyPendingRewards(msg.sender);

        (
            uint256[] memory collAmounts,
            ,
            address[] memory collaterals
        ) = collateralManagerCached.getTroveColls(msg.sender);

        collateralManager.clearEToken(msg.sender, DataTypes.Status.active);
        uint256 debt = troveManagerCached.getTroveDebt(msg.sender);

        uint256 gas = USDE_GAS_COMPENSATION();
        _requireSufficientUSDEBalance(
            usdeTokenCached,
            msg.sender,
            debt.sub(gas)
        );

        uint256 newTCR = _getNewTCRFromTroveChange(debt, false, price);
        _requireNewTCRisAboveCCR(newTCR);

        troveManagerCached.removeStake(msg.sender);
        troveManagerCached.closeTrove(msg.sender);

        emit TroveUpdated(
            msg.sender,
            0,
            new address[](0),
            new uint256[](0),
            new uint256[](0),
            BorrowerOperation.closeTrove
        );

        // Burn the repaid USDE from the user's balance and the gas compensation from the Gas Pool
        _repayUSDE(
            activePoolCached,
            usdeTokenCached,
            msg.sender,
            debt.sub(gas)
        );
        _repayUSDE(activePoolCached, usdeTokenCached, gasPoolAddress, gas);

        // Send the collateral back to the user
        activePoolCached.sendCollateral(msg.sender, collaterals, collAmounts);
    }

    /**
     * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
     */
    function claimCollateral() external override nonReentrant {
        _requireNotPaused();
        // send collateral from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
    }

    function setPause(bool val) external override onlyOwner {
        paused = val;
        if (paused) {
            emit Paused();
        } else {
            emit Unpaused();
        }
    }

    // --- Helper functions ---

    // Send collateral to Active Pool and increase its recorded collateral balance
    function _activePoolAddColl(
        address _from,
        address[] memory _colls,
        uint256[] memory _amounts
    ) internal {
        uint256 amountsLen = _amounts.length;
        address collAddress;
        uint256 amount;
        for (uint256 i; i < amountsLen; i++) {
            collAddress = _colls[i];
            amount = _amounts[i];
            _singleTransferCollateralIntoActivePool(_from, collAddress, amount);
        }
    }

    // does one transfer of collateral into active pool. Checks that it transferred to the active pool correctly.
    function _singleTransferCollateralIntoActivePool(
        address _from,
        address _coll,
        uint256 _amount
    ) internal {
        if (_coll == address(WETH)) {
            if (_from != stabilityPoolAddress) {
                WETH.deposit{value: msg.value}();
                WETH.transferFrom(
                    address(this),
                    address(activePool),
                    msg.value
                );
                if (_amount > msg.value) {
                    SafeERC20Upgradeable.safeTransferFrom(
                        IERC20Upgradeable(address(WETH)),
                        _from,
                        address(activePool),
                        _amount.sub(msg.value)
                    );
                }
            } else {
                SafeERC20Upgradeable.safeTransferFrom(
                    IERC20Upgradeable(_coll),
                    _from,
                    address(activePool),
                    _amount
                );
            }
        } else {
            SafeERC20Upgradeable.safeTransferFrom(
                IERC20Upgradeable(_coll),
                _from,
                address(activePool),
                _amount
            );
        }
    }

    function _triggerBorrowingFee(
        ITroveManager _troveManager,
        IUSDEToken _usdeToken,
        uint256 _USDEAmount,
        uint256 _maxFeePercentage,
        bool _isRecoveryMode
    ) internal returns (uint256) {
        uint256 USDEFee;
        if (!_isRecoveryMode) {
            _troveManager.decayBaseRateFromBorrowing(); // decay the baseRate state variable
            USDEFee = _troveManager.getBorrowingFee(_USDEAmount);
        } else {
            uint256 rate = collateralManager.getRecoveryFee();
            USDEFee = rate.mul(_USDEAmount).div(DECIMAL_PRECISION);
        }

        _requireUserAcceptsFee(USDEFee, _USDEAmount, _maxFeePercentage);

        // Send fee to treasury contract
        _usdeToken.mintToTreasury(USDEFee, _troveManager.getFactor());

        return USDEFee;
    }

    // Update trove's coll and debt based on whether they increase or decrease
    function _updateTroveFromAdjustment(
        ITroveManager _troveManager,
        address _borrower,
        uint256 _debtChange,
        bool _isDebtIncrease
    ) internal {
        if (_isDebtIncrease) {
            _troveManager.increaseTroveDebt(_borrower, _debtChange);
        } else {
            _troveManager.decreaseTroveDebt(_borrower, _debtChange);
        }
    }

    function _moveTokensAndCollateralfromAdjustment(
        IActivePool _activePool,
        IUSDEToken _usdeToken,
        address _borrower,
        address[] memory _collaterals,
        uint256[] memory _amountsOut,
        uint256 _USDEChange,
        bool _isDebtIncrease,
        uint256 _netDebtChange
    ) internal {
        if (_isDebtIncrease) {
            _withdrawUSDE(
                _activePool,
                _usdeToken,
                _borrower,
                _USDEChange,
                _netDebtChange
            );
        } else {
            _repayUSDE(_activePool, _usdeToken, _borrower, _USDEChange);
        }
        _activePool.sendCollateral(_borrower, _collaterals, _amountsOut);
    }

    // Issue the specified amount of USDE to _account and increases the total active debt (_netDebtIncrease potentially includes a USDEFee)
    function _withdrawUSDE(
        IActivePool _activePool,
        IUSDEToken _usdeToken,
        address _account,
        uint256 _USDEAmount,
        uint256 _netDebtIncrease
    ) internal {
        _activePool.increaseUSDEDebt(_netDebtIncrease);
        _usdeToken.mint(_account, _USDEAmount);
    }

    // Burn the specified amount of USDE from _account and decreases the total active debt
    function _repayUSDE(
        IActivePool _activePool,
        IUSDEToken _usdeToken,
        address _account,
        uint256 _USDE
    ) internal {
        _activePool.decreaseUSDEDebt(_USDE);
        _usdeToken.burn(_account, _USDE);
    }

    function _removeZero(
        address[] memory _colls,
        uint256[] memory _amounts
    ) internal pure returns (address[] memory, uint256[] memory) {
        uint256 collLen = _colls.length;
        uint256 count;
        for (uint256 i = 0; i < collLen; i++) {
            if (_amounts[i] != 0) {
                count = count + 1;
            }
        }
        address[] memory colls = new address[](count);
        uint256[] memory amounts = new uint256[](count);
        uint256 index;
        for (uint256 i = 0; i < collLen; i++) {
            if (_amounts[i] != 0) {
                colls[index] = _colls[i];
                amounts[index] = _amounts[i];
                index = index + 1;
            }
        }
        return (colls, amounts);
    }

    // --- 'Require' wrapper functions ---

    function _requireIsContract(address _contract) internal view {
        require(_contract.isContract(), Errors.IS_NOT_CONTRACT);
    }

    function _requireNotPaused() internal view {
        require(!paused, Errors.PROTOCOL_PAUSED);
    }

    function _requireValidOpenTroveCollateral(
        address[] memory _colls,
        uint256[] memory _amounts,
        uint256 _ethAmount
    ) internal view {
        uint256 collsLen = _colls.length;
        _requireLengthsEqual(collsLen, _amounts.length);
        _requireNoDuplicateColls(_colls);
        if (_ethAmount == 0) {
            require(collsLen != 0, Errors.BO_LENGTH_IS_ZERO);
        } else {
            require(
                collateralManager.getIsActive(address(WETH)),
                Errors.BO_ETH_NOT_ACTIVE_OR_PAUSED
            );
        }
        for (uint256 i; i < collsLen; i++) {
            require(
                collateralManager.getIsActive(_colls[i]),
                Errors.BO_COLL_NOT_ACTIVE_PAUSED
            );
            require(_amounts[i] != 0, Errors.BO_COLL_AMOUNT_IS_ZERO);
        }
    }

    function _requireValidAdjustCollateralAmounts(
        address[] memory _colls,
        uint256[] memory _amounts,
        uint256 _ethAmount,
        bool add
    ) internal view {
        uint256 collsLen = _colls.length;
        _requireLengthsEqual(collsLen, _amounts.length);
        _requireNoDuplicateColls(_colls);
        if (_ethAmount != 0) {
            require(
                collateralManager.getIsActive(address(WETH)),
                Errors.BO_ETH_NOT_ACTIVE
            );
            if (!add) {
                _requireNoWETHColls(_colls);
            }
        }
        for (uint256 i; i < collsLen; ++i) {
            require(
                (add && collateralManager.getIsActive(_colls[i])) ||
                    (!add && collateralManager.getIsSupport(_colls[i])),
                Errors.BO_COLL_NOT_ACTIVE_OR_NOT_SUPPORT
            );
            require(_amounts[i] != 0, Errors.BO_COLL_AMOUNT_IS_ZERO);
        }
    }

    function _requireNoOverlapColls(
        address[] memory _colls1,
        address[] memory _colls2
    ) internal pure {
        uint256 colls1Len = _colls1.length;
        uint256 colls2Len = _colls2.length;
        for (uint256 i; i < colls1Len; ++i) {
            for (uint256 j; j < colls2Len; j++) {
                require(_colls1[i] != _colls2[j], Errors.BO_OVERLAP_COLL);
            }
        }
    }

    function _requireNoWETHColls(address[] memory _colls) internal view {
        uint256 collsLen = _colls.length;
        for (uint256 i; i < collsLen; ++i) {
            require(
                _colls[i] != address(WETH),
                Errors.BO_CANNOT_WITHDRAW_AND_ADD_COLL
            );
        }
    }

    function _requireNoDuplicateColls(address[] memory _colls) internal pure {
        uint256 collsLen = _colls.length;
        for (uint256 i; i < collsLen; ++i) {
            for (uint256 j = i.add(1); j < collsLen; j++) {
                require(_colls[i] != _colls[j], Errors.BO_DUPLICATE_COLL);
            }
        }
    }

    function _requireNonZeroAdjustment(
        uint256[] memory _amountsIn,
        uint256[] memory _amountsOut,
        uint256 _USDEChange
    ) internal pure {
        require(
            ERDMath._arrayIsNonzero(_amountsIn) ||
                ERDMath._arrayIsNonzero(_amountsOut) ||
                _USDEChange != 0,
            Errors.BO_MUST_CHANGE_FOR_COLL_OR_DEBT
        );
    }

    function _requireTroveisActive(
        ITroveManager _troveManager,
        address _borrower
    ) internal view {
        uint256 status = _troveManager.getTroveStatus(_borrower);
        require(status == 1, Errors.BO_TROVE_NOT_EXIST_OR_CLOSED);
    }

    function _requireValidAdjustmentInCurrentMode(
        bool _isRecoveryMode,
        uint256[] memory _collWithdrawals,
        bool _isDebtIncrease,
        LocalVariables_adjustTrove memory _vars
    ) internal view {
        /*
         *In Recovery Mode, only allow:
         *
         * - Pure collateral top-up
         * - Pure debt repayment
         * - Collateral top-up with debt repayment
         * - A debt increase combined with a collateral top-up which makes the ICR >= 150% and improves the ICR (and by extension improves the TCR).
         *
         * In Normal Mode, ensure:
         *
         * - The new ICR is above MCR
         * - The adjustment won't pull the TCR below CCR
         */
        if (_isRecoveryMode) {
            require(
                !ERDMath._arrayIsNonzero(_collWithdrawals),
                Errors.BO_CANNOT_WITHDRAWAL_COLL_IN_RM
            );
            if (_isDebtIncrease) {
                _requireICRisAboveCCR(_vars.newICR);
                // _requireNewICRisAboveOldICR(_vars.newICR, _vars.oldICR);
                require(
                    _vars.newICR >= _vars.oldICR,
                    Errors.BO_CANNOT_DECREASE_ICR_IN_RM
                );
            }
        } else {
            // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
            _vars.newTCR = _getNewTCRFromTroveChange(
                _vars.netDebtChange,
                _isDebtIncrease,
                _vars.price
            );
            _requireNewTCRisAboveCCR(_vars.newTCR);
        }
    }

    function _requireICRisAboveMCR(uint256 _newICR) internal view {
        require(
            _newICR >= collateralManager.getMCR(),
            Errors.BO_NOT_PERMIT_FOR_ICR_LT_MCR
        );
    }

    function _requireICRisAboveCCR(uint256 _newICR) internal view {
        require(_newICR >= CCR(), Errors.BO_TROVE_ICR_MUST_GT_CCR);
    }

    function _requireNewTCRisAboveCCR(uint256 _newTCR) internal view {
        require(_newTCR >= CCR(), Errors.BO_NOT_PERMIT_FOR_TCR_LT_CCR);
    }

    function _requireAtLeastMinNetDebt(uint256 _netDebt) internal view {
        require(
            _netDebt >= collateralManager.getMinNetDebt(),
            Errors.BO_TROVE_DEBT_MUST_GT_MIN
        );
    }

    function _requireSufficientUSDEBalance(
        IUSDEToken _usdeToken,
        address _borrower,
        uint256 _debtRepayment
    ) internal view {
        require(
            _usdeToken.balanceOf(_borrower) >= _debtRepayment,
            Errors.BO_USDE_INSUFFICIENT
        );
    }

    function _requireValidMaxFeePercentage(
        uint256 _maxFeePercentage,
        bool _isRecoveryMode
    ) internal view {
        if (_isRecoveryMode) {
            require(
                _maxFeePercentage <= DECIMAL_PRECISION,
                Errors.BO_MAX_FEE_EXCEED_100
            );
        } else {
            require(
                _maxFeePercentage >= collateralManager.getBorrowingFeeFloor() &&
                    _maxFeePercentage <= DECIMAL_PRECISION,
                Errors.BO_MAX_FEE_NOT_IN_RANGE
            );
        }
    }

    // Function require length equal, used to save contract size on revert strings.
    function _requireLengthsEqual(
        uint256 length1,
        uint256 length2
    ) internal pure {
        require(length1 == length2, Errors.LENGTH_MISMATCH);
    }

    function _getNewTCRFromTroveChange(
        uint256 _debtChange,
        bool _isDebtIncrease,
        uint256 _price
    ) internal view returns (uint256) {
        (, , uint256 totalValue) = getEntireSystemColl(_price);
        uint256 totalDebt = getEntireSystemDebt();

        totalDebt = _isDebtIncrease
            ? totalDebt.add(_debtChange)
            : totalDebt.sub(_debtChange);

        uint256 newTCR = ERDMath._computeCR(totalValue, totalDebt);
        return newTCR;
    }

    function getCompositeDebt(
        uint256 _debt
    ) external view override returns (uint256) {
        return _getCompositeDebt(_debt, USDE_GAS_COMPENSATION());
    }

    function CCR() internal view returns (uint256) {
        return collateralManager.getCCR();
    }

    function USDE_GAS_COMPENSATION() public view returns (uint256) {
        return collateralManager.getUSDEGasCompensation();
    }
}
