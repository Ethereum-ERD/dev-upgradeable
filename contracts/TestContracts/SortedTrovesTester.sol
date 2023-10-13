// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../Interfaces/ISortedTroves.sol";
import "../SortedTroves.sol";

// Testing file for sorted troves without checks, can reinsert any time.

contract SortedTrovesTester is SortedTroves {
    function callInsert(
        address _id,
        uint256 _ICR,
        address _prevId,
        address _nextId
    ) external {
        _insert(_id, _ICR, _prevId, _nextId);
    }

    function callRemove(address _id) external {
        _remove(_id);
    }

    function callReInsert(
        address _id,
        uint256 _newICR,
        address _prevId,
        address _nextId
    ) external {
        if (!contains(_id)) {
            revert Errors.ST_ListNotContainsNode();
        }
        // ICR must be non-zero
        if (_newICR == 0) {
            revert Errors.ST_ZeroICR();
        }

        // Remove node from the list
        _remove(_id);

        _insert(_id, _newICR, _prevId, _nextId);
    }
}
