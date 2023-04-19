// SPDX-License-Identifier: MITs
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./DataTypes.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/ITroveDebt.sol";
import "./Interfaces/ITroveInterestRateStrategy.sol";
import "./Dependencies/ERDMath.sol";
import "./Dependencies/WadRayMath.sol";

library TroveLogic {
    using SafeMathUpgradeable for uint256;
    using WadRayMath for uint256;

    using TroveLogic for DataTypes.TroveData;

    /**
     * @dev Emitted when the state of a reserve is updated
     * @param liquidityRate The new liquidity rate
     * @param borrowRate The new borrow rate
     * @param liquidityIndex The new liquidity index
     * @param borrowIndex The new borrow index
     **/
    event TroveDataUpdated(
        uint256 liquidityRate,
        uint256 borrowRate,
        uint256 liquidityIndex,
        uint256 borrowIndex
    );

    /**
     * @dev Returns the ongoing normalized income for the reserve
     * A value of 1e27 means there is no income. As time passes, the income is accrued
     * A value of 2*1e27 means for each unit of asset one unit of income has been accrued
     * @param trove The trove object
     * @return the normalized income. expressed in ray
     **/
    function getNormalizedIncome(
        DataTypes.TroveData storage trove
    ) internal view returns (uint256) {
        uint40 timestamp = trove.lastUpdateTimestamp;

        //solium-disable-next-line
        if (timestamp == uint40(block.timestamp)) {
            //if the index was updated in the same block, no need to perform any calculation
            return trove.liquidityIndex;
        }

        uint256 cumulated = ERDMath
            .calculateLinearInterest(trove.currentLiquidityRate, timestamp)
            .rayMul(trove.liquidityIndex);

        return cumulated;
    }

    /**
     * @dev Returns the ongoing normalized debt for the trove
     * A value of 1e27 means there is no debt. As time passes, the income is accrued
     * A value of 2*1e27 means that for each unit of debt, one unit worth of interest has been accumulated
     * @param trove The reserve object
     * @return The normalized debt. expressed in ray
     **/
    function getNormalizedDebt(
        DataTypes.TroveData storage trove
    ) internal view returns (uint256) {
        uint40 timestamp = trove.lastUpdateTimestamp;

        //solium-disable-next-line
        if (timestamp == uint40(block.timestamp)) {
            //if the index was updated in the same block, no need to perform any calculation
            return trove.borrowIndex;
        }

        uint256 cumulated = ERDMath
            .calculateCompoundedInterest(trove.currentBorrowRate, timestamp)
            .rayMul(trove.borrowIndex);

        return cumulated;
    }

    /**
     * @dev Updates the liquidity cumulative index and the borrow index.
     * @param trove the reserve object
     **/
    function updateState(DataTypes.TroveData storage trove) internal {
        uint256 scaledDebt = ITroveDebt(trove.troveDebtAddress)
            .scaledTotalSupply();
        uint256 previousBorrowIndex = trove.borrowIndex;
        uint256 previousLiquidityIndex = trove.liquidityIndex;
        uint40 lastUpdatedTimestamp = trove.lastUpdateTimestamp;

        /*(uint256 newLiquidityIndex, uint256 newBorrowIndex) = */
        _updateIndexes(
            trove,
            scaledDebt,
            previousLiquidityIndex,
            previousBorrowIndex,
            lastUpdatedTimestamp
        );
    }

    struct UpdateInterestRatesLocalVars {
        uint256 availableLiquidity;
        uint256 newLiquidityRate;
        uint256 newRate;
    }

    /**
     * @dev Updates the reserve current stable borrow rate, the current borrow rate and the current liquidity rate
     * @param trove The address of the reserve to be updated
     **/
    function updateInterestRates(DataTypes.TroveData storage trove) internal {
        UpdateInterestRatesLocalVars memory vars;

        (vars.newLiquidityRate, vars.newRate) = ITroveInterestRateStrategy(
            trove.interestRateAddress
        ).calculateInterestRates();
        require(
            vars.newLiquidityRate <= type(uint128).max,
            "Errors.RL_LIQUIDITY_RATE_OVERFLOW"
        );
        require(
            vars.newRate <= type(uint128).max,
            "Errors.RL_BORROW_RATE_OVERFLOW"
        );

        trove.currentLiquidityRate = uint128(vars.newLiquidityRate);
        trove.currentBorrowRate = uint128(vars.newRate);

        emit TroveDataUpdated(
            vars.newLiquidityRate,
            vars.newRate,
            trove.liquidityIndex,
            trove.borrowIndex
        );
    }

    /**
     * @dev Updates the reserve indexes and the timestamp of the update
     * @param trove The reserve reserve to be updated
     * @param scaledDebt The scaled debt
     * @param liquidityIndex The last stored liquidity index
     * @param borrowIndex The last stored borrow index
     **/
    function _updateIndexes(
        DataTypes.TroveData storage trove,
        uint256 scaledDebt,
        uint256 liquidityIndex,
        uint256 borrowIndex,
        uint40 timestamp
    ) internal returns (uint256, uint256) {
        uint256 currentLiquidityRate = trove.currentLiquidityRate;

        uint256 newLiquidityIndex = liquidityIndex;
        uint256 newBorrowIndex = borrowIndex;

        //only cumulating if there is any income being produced
        if (currentLiquidityRate > 0) {
            uint256 cumulatedLiquidityInterest = ERDMath
                .calculateLinearInterest(currentLiquidityRate, timestamp);
            newLiquidityIndex = cumulatedLiquidityInterest.rayMul(
                liquidityIndex
            );
            require(
                newLiquidityIndex <= type(uint128).max,
                "Errors.RL_LIQUIDITY_INDEX_OVERFLOW"
            );

            trove.liquidityIndex = uint128(newLiquidityIndex);

            //as the liquidity rate might come only from stable rate loans, we need to ensure
            //that there is actual debt before accumulating
            if (scaledDebt != 0) {
                uint256 cumulatedBorrowInterest = ERDMath
                    .calculateCompoundedInterest(
                        trove.currentBorrowRate,
                        timestamp
                    );
                newBorrowIndex = cumulatedBorrowInterest.rayMul(borrowIndex);
                require(
                    newBorrowIndex <= type(uint128).max,
                    "Errors.RL_BORROW_INDEX_OVERFLOW"
                );
                trove.borrowIndex = uint128(newBorrowIndex);
            }
        }

        //solium-disable-next-line
        trove.lastUpdateTimestamp = uint40(block.timestamp);
        return (newLiquidityIndex, newBorrowIndex);
    }
}
