// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

/**
 * @title Errors library
 * @author ERD
 * @notice Defines the error messages emitted by the different contracts of the ERD protocol
 * @dev Error messages prefix glossary:
 *  - AP = ActivePool
 *  - BO = BorrowerOperations
 *  - CM = CollateralManager
 *  - CSP = CollSurplusPool
 *  - DP = DefaultPool
 *  - ET = EToken
 *  - ST = SortedTroves
 *  - SP = StabilityPool
 *  - TD = TroveDebt
 *  - TM = TroveManager
 *  - TML = TroveManagerLiquidations
 *  - TMR = TroveManagerRedemptions
 *  - CE = Common Error
 *  - P = Pausable
 *  - CALLER = Caller
 */
library Errors {
    //common errors
    string public constant IS_NOT_CONTRACT = "100"; // 'Contract check error'
    string public constant PROTOCOL_PAUSED = "101"; // 'Protocol paused'
    string public constant LENGTH_MISMATCH = "102"; // 'Length mismatch'
    string public constant SEND_ETH_FAILED = "103";

    string public constant CALLER_NOT_AP = "200"; // 'Caller is not ActivePool'
    string public constant CALLER_NOT_BO = "201"; // 'Caller is not BorrowerOperations'
    string public constant CALLER_NOT_CM = "202"; // 'Caller is not CollateralManager'
    string public constant CALLER_NOT_SP = "203"; // 'Caller is not Stability Pool'
    string public constant CALLER_NOT_TM = "204"; // 'Caller is not TroveManager'
    string public constant CALLER_NOT_TML = "205"; // 'Caller is not TroveManagerLiquidations'
    string public constant CALLER_NOT_TMR = "206"; // 'Caller is not TroveManagerRedemptions'
    string public constant CALLER_NOT_TML_TMR = "207"; // 'Caller is neither TroveManagerLiquidations nor TroveManagerRedemptions'
    string public constant CALLER_NOT_BO_TM = "208"; // 'Caller is neither BorrowerOperations nor TroveManager'
    string public constant CALLER_NOT_BO_TML_TMR = "209"; // 'Caller is neither BorrowerOperations nor TroveManagerLiquidations nor TroveManagerRedemptions'
    string public constant CALLER_NOT_BO_TMR = "210"; // 'Caller is neither BorrowerOperations nor TroveManagerRedemptions'
    string public constant CALLER_NOT_BO_TM_SP_TMR_TML = "211"; // 'Caller is neither BorrowerOperations nor TroveManager nor StabilityPool nor TMR nor TML'

    //contract specific errors
    string public constant BO_TROVE_ACTIVE = "1"; // 'Trove is active'
    string public constant BO_DEBT_INCREASE_ZERO = "2"; // 'Debt increase requires non-zero debtChange'
    string public constant BO_REPAID_AMOUNT_LARGER_DEBT = "3"; // 'Amount repaid must not be larger than the Trove's debt'
    string public constant BO_NOT_PERMIT_IN_RECOVERY_MODE = "4"; // 'Operation not permitted during Recovery Mode'
    string public constant BO_LENGTH_IS_ZERO = "5"; // 'Length is zero'
    string public constant BO_ETH_NOT_ACTIVE_OR_PAUSED = "6"; // 'ETH does not active or is paused'
    string public constant BO_COLL_NOT_ACTIVE_PAUSED = "7"; // 'Collateral does not active or is paused'
    string public constant BO_COLL_AMOUNT_IS_ZERO = "8"; // 'Collateral amount is 0'
    string public constant BO_ETH_NOT_ACTIVE = "9"; // 'ETH does not active'
    string public constant BO_COLL_NOT_ACTIVE_OR_NOT_SUPPORT = "10"; // 'Collateral does not support or active'
    string public constant BO_OVERLAP_COLL = "11"; // 'Overlap Colls'
    string public constant BO_DUPLICATE_COLL = "12"; // 'Duplicate Colls'
    string public constant BO_CANNOT_WITHDRAW_AND_ADD_COLL = "13"; // 'Cannot withdraw and add Coll'
    string public constant BO_MUST_CHANGE_FOR_COLL_OR_DEBT = "14"; // 'There must be either a collateral change or a debt change'
    string public constant BO_TROVE_NOT_EXIST_OR_CLOSED = "15"; // 'Trove does not exist or is closed'
    string public constant BO_CANNOT_WITHDRAWAL_COLL_IN_RM = "16"; // 'Collateral withdrawal not permitted Recovery Mode'
    string public constant BO_CANNOT_DECREASE_ICR_IN_RM = "17"; // 'Cannot decrease your Trove's ICR in Recovery Mode'
    string public constant BO_NOT_PERMIT_FOR_ICR_LT_MCR = "18"; // 'An operation that would result in ICR < MCR is not permitted'
    string public constant BO_TROVE_ICR_MUST_GT_CCR = "19"; // 'Operation must leave trove with ICR >= CCR'
    string public constant BO_NOT_PERMIT_FOR_TCR_LT_CCR = "20"; // 'An operation that would result in TCR < CCR is not permitted'
    string public constant BO_TROVE_DEBT_MUST_GT_MIN = "21"; // 'Trove's net debt must be greater than minimum'
    string public constant BO_USDE_INSUFFICIENT = "22"; // 'Caller doesnt have enough USDE to make repayment'
    string public constant BO_MAX_FEE_EXCEED_100 = "23"; // 'Max fee percentage must less than or equal to 100%'
    string public constant BO_MAX_FEE_NOT_IN_RANGE = "24"; // 'Max fee percentage must be between 0.25% and 100%'

    string public constant CM_COLL_EXISTS = "30"; // 'Collateral already exists'
    string public constant CM_COLL_MUST_PAUSED = "31"; // 'Collateral not pause'
    string public constant CM_COLL_LT_ONE = "32"; // 'Need at least one collateral support'
    string public constant CM_COLL_NOT_SUPPORT = "33"; // 'Collateral not support'
    string public constant CM_RATIO_MUST_LT_100 = "34"; // 'Ratio must be less than 100%'
    string public constant CM_COLL_NOT_ACTIVE = "35"; // 'Collateral not active'

    string public constant CSP_CANNOT_CLAIM = "40"; // 'No collateral available to claim'

    string public constant ET_INVALID_ADJUSTMENT = "50";

    string public constant ST_SIZE_ZERO = "60"; // 'Size can't be zero'
    string public constant ST_LIST_FULL = "61"; // 'List is full'
    string public constant ST_LIST_CONTAINS_NODE = "62"; // 'List already contains the node'
    string public constant ST_ID_ZERO = "63"; // 'Id cannot be zero'
    string public constant ST_ICR_NEGATIVE = "64"; // 'ICR must be positive'
    string public constant ST_LIST_NOT_CONTAIN_NODE = "65"; // 'List does not contain the id'

    string public constant SP_USDE_LOSS_LT_1 = "70"; // 'USDELoss < 1'
    string public constant SP_EQ_ZERO = "71"; // 'P = 0'
    string public constant SP_CANNOT_WITHDRAW_WITH_ICR_LT_MCR = "72"; // 'Cannot withdraw while there are troves with ICR < MCR'
    string public constant SP_ZERO_DEPOSIT = "73"; // 'User must have a non-zero deposit'
    string public constant SP_MUST_NO_DEPOSIT = "74"; // 'User must have no deposit'
    string public constant SP_AMOUNT_ZERO = "75"; // 'Amount must be non-zero'
    string public constant SP_CALLER_NO_ACTIVE_TROVE = "76"; // "Caller must have an active trove to withdraw collater Gain to"
    string public constant SP_ZERO_GAIN = "77"; // 'Caller must have non-zero Collateral Gain'
    string public constant SP_ALREADY_REGISTERED_FRONT_END = "78"; // 'Must not already be a registered front end'
    string public constant SP_MUST_REGISTERED_OR_ZERO_ADDRESS = "79"; // 'Tag must be a registered front end, or the zero address'
    string public constant SP_KICKBACK_RATE_NOT_IN_RANGE = "80"; // 'Kickback rate must be in range [0,1]'

    string public constant TD_AMOUNT_ZERO = "81"; // 'Invalid mint amount'

    string public constant TM_BORROW_RATE_OVERFLOW = "82";
    string public constant TM_BORROW_INDEX_OVERFLOW = "83";
    string public constant TM_ONLY_ONE_TROVE_IN_SYSTEM = "84"; //  'Only one trove in the system'
    string public constant TM_BASERATE_MUST_GT_ZERO = "85"; //  'newBaseRate must be > 0'
    string public constant TM_FEE_TOO_HIGH = "86"; //  'Fee would eat up all returned collateral'
    string public constant TM_TROVE_NOT_EXIST_OR_CLOSED = "87"; //  'Trove does not exist or is closed'

    string public constant TMR_CANNOT_REDEEM = "88"; // 'Unable to redeem any amount'
    string public constant TMR_REDEMPTION_AMOUNT_EXCEED_BALANCE = "89"; // 'Requested redemption amount must be <= user's USDE token balance'
    string public constant TMR_AMOUNT_MUST_GT_ZERO = "90"; // 'Amount must be greater than zero'
    string public constant TMR_CANNOT_REDEEM_WHEN_TCR_LT_MCR = "91"; // 'Cannot redeem when TCR < MCR'
    string public constant TMR_REDEMPTION_NOT_ALLOWED = "92"; // 'Redemptions are not allowed during bootstrap phase'
}
