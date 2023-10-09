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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

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
        _requireIsContract(_collateralManagerAddress);
        _requireIsContract(_tokenAddress);
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
        _recipient;
        _amount;
        revert("TRANSFER_NOT_SUPPORTED");
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
        _sender;
        _recipient;
        _amount;
        revert("TRANSFER_NOT_SUPPORTED");
    }

    function allowance(
        address _owner,
        address _spender
    )
        public
        view
        virtual
        override(IERC20Upgradeable, ERC20Upgradeable)
        returns (uint256)
    {
        _owner;
        _spender;
        revert("ALLOWANCE_NOT_SUPPORTED");
    }

    function approve(
        address _spender,
        uint256 _amount
    )
        public
        virtual
        override(IERC20Upgradeable, ERC20Upgradeable)
        returns (bool)
    {
        _spender;
        _amount;
        revert("APPROVAL_NOT_SUPPORTED");
    }

    function increaseAllowance(
        address _spender,
        uint256 _addedValue
    ) public virtual override(ERC20Upgradeable) returns (bool) {
        _spender;
        _addedValue;
        revert("ALLOWANCE_NOT_SUPPORTED");
    }

    function decreaseAllowance(
        address _spender,
        uint256 _subtractedValue
    ) public virtual override(ERC20Upgradeable) returns (bool) {
        _spender;
        _subtractedValue;
        revert("ALLOWANCE_NOT_SUPPORTED");
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

    function _requireIsContract(address _contract) internal view {
        require(_contract.code.length > 0, Errors.IS_NOT_CONTRACT);
    }

    function _requireIsCollateralManager() internal view {
        require(msg.sender == address(collateralManager), Errors.CALLER_NOT_CM);
    }
}
