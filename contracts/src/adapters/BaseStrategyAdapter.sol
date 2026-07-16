// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IStrategyAdapter} from "./IStrategyAdapter.sol";

/// @title BaseStrategyAdapter
/// @notice Shared testnet implementation for the three Mining Note adapters. It custodies the vault
///         asset (USDC) directly and reports its balance as `totalAssets()`. This is a HONEST stub:
///         it moves real tokens and enforces `onlyVault`, but carries no yield engine and executes no
///         strategy on-chain (all real rebalancing/yield is off-chain / multisig — phased plan).
/// @dev    Vault-only for state-changing calls. Uses SafeERC20 for the token leg. Checks-effects-
///         interactions: `divest` computes the send amount, then transfers last.
abstract contract BaseStrategyAdapter is IStrategyAdapter {
    using SafeERC20 for IERC20;

    /// @inheritdoc IStrategyAdapter
    IERC20 public immutable override asset;

    /// @inheritdoc IStrategyAdapter
    address public immutable override vault;

    error NotVault(address caller);
    error ZeroAddress();

    /// @param asset_ Vault-facing asset (USDC, 6 decimals). Non-zero.
    /// @param vault_ Owning vault, the only privileged caller. Non-zero.
    constructor(IERC20 asset_, address vault_) {
        if (address(asset_) == address(0) || vault_ == address(0)) revert ZeroAddress();
        asset = asset_;
        vault = vault_;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault(msg.sender);
        _;
    }

    /// @inheritdoc IStrategyAdapter
    /// @dev Stub: position value == asset balance held by the adapter.
    function totalAssets() public view virtual override returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @inheritdoc IStrategyAdapter
    /// @dev The vault has already transferred `amount` in; the stub just acknowledges it (no-op body).
    ///      A production adapter would deploy the inflow into its underlying venue here.
    function invest(uint256 amount) external virtual override onlyVault {
        // no-op: funds are already custodied by this adapter (balance == position for the stub).
        amount; // silence unused-parameter warning without changing the ABI.
    }

    /// @inheritdoc IStrategyAdapter
    /// @dev Sends back min(amount, balance). Effects (compute) before interaction (transfer).
    function divest(uint256 amount) external virtual override onlyVault returns (uint256 withdrawn) {
        uint256 bal = asset.balanceOf(address(this));
        withdrawn = amount > bal ? bal : amount;
        if (withdrawn > 0) {
            asset.safeTransfer(vault, withdrawn);
        }
    }
}
