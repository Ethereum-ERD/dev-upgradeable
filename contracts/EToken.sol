// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./Interfaces/ICollateralManager.sol";
import "./Interfaces/IEToken.sol";
import "./Errors.sol";

contract EToken is ERC20Upgradeable, OwnableUpgradeable, IEToken {
    using SafeMathUpgradeable for uint256;

    ICollateralManager internal collateralManager;
    address public tokenAddress;

    function initialize(
        string memory name_,
        string memory symbol_
    ) public initializer {
        __Ownable_init();
        __ERC20_init(name_, symbol_);
    }

    function setAddresses(
        address _collateralManagerAddress,
        address _tokenAddress
    ) external onlyOwner {
        collateralManager = ICollateralManager(_collateralManagerAddress);
        tokenAddress = _tokenAddress;

        emit CollateralManagerAddressChanged(_collateralManagerAddress);
        emit TokenAddressChanged(_tokenAddress);
    }

    function mint(
        address _account,
        uint256 _amount
    ) external override returns (uint256) {
        _requireIsCollateralManager();
        uint256 share = getShare(_amount);
        _mint(_account, share);
        return share;
    }

    function burn(
        address _account,
        uint256 _amount
    ) external override returns (uint256) {
        _requireIsCollateralManager();
        uint256 share = getShare(_amount);
        _burn(_account, share);
        return share;
    }

    function clear(address _account) external override {
        _requireIsCollateralManager();
        uint256 share = super.balanceOf(_account);
        _burn(_account, share);
    }

    function reset(
        address _account,
        uint256 _amount
    ) external override returns (uint256) {
        _requireIsCollateralManager();
        uint256 oldShare = super.balanceOf(_account);
        uint256 newShare = getShare(_amount);
        if (oldShare > newShare) {
            _burn(_account, oldShare.sub(newShare));
        } else {
            _mint(_account, newShare.sub(oldShare));
        }
        return newShare;
    }

    function transfer(
        address _recipient,
        uint256 _amount
    )
        public
        virtual
        override(IERC20Upgradeable, ERC20Upgradeable)
        returns (bool)
    {
        uint256 share = getShare(_amount);
        _requireValidAdjustment(msg.sender, _amount);
        _transfer(msg.sender, _recipient, share);
        return true;
    }

    function transferFrom(
        address _sender,
        address _recipient,
        uint256 _amount
    )
        public
        virtual
        override(IERC20Upgradeable, ERC20Upgradeable)
        returns (bool)
    {
        uint256 share = getAmount(_amount);
        _requireValidAdjustment(_sender, _amount);
        super.transferFrom(_sender, _recipient, share);
        return true;
    }

    function sharesOf(address _account) public view override returns (uint256) {
        return super.balanceOf(_account);
    }

    function getShare(uint256 _amount) public view override returns (uint256) {
        // StETH: return getSharesByPooledEth(uint256 _ethAmount);
        return _amount;
    }

    function getAmount(uint256 _share) public view override returns (uint256) {
        // StETH: return getPooledEthByShares(uint256 _sharesAmount);
        return _share;
    }

    function balanceOf(
        address _account
    )
        public
        view
        virtual
        override(IERC20Upgradeable, ERC20Upgradeable)
        returns (uint256)
    {
        return getAmount(sharesOf(_account));
    }

    function totalSupply()
        public
        view
        virtual
        override(IERC20Upgradeable, ERC20Upgradeable)
        returns (uint256)
    {
        return getAmount(totalShareSupply());
    }

    function totalShareSupply() public view override returns (uint256) {
        return super.totalSupply();
    }

    function _requireIsCollateralManager() internal view {
        require(msg.sender == address(collateralManager), Errors.CALLER_NOT_CM);
    }

    function _requireValidAdjustment(
        address _sender,
        uint256 _amount
    ) internal {
        require(
            collateralManager.validAdjustment(_sender, tokenAddress, _amount),
            Errors.ET_INVALID_ADJUSTMENT
        );
    }
}
