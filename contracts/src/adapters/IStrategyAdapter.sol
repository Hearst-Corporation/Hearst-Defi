// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IStrategyAdapter
/// @notice Minimal strategy-adapter interface consumed by `PermissionedDynaVault`. An adapter holds
///         value on behalf of the vault (a mining-power position, a BTC pouch, ...) and reports the
///         asset-denominated value of that position on demand. Adapters are TESTNET stubs: they hold
///         USDC directly and are the accounting boundary — there is NO on-chain yield logic, NO
///         auto-execution of strategies here (that stays off-chain / multisig, per the phased plan).
/// @dev    The vault is the only privileged caller (`onlyVault`). The adapter never pulls funds by
///         itself: the vault pushes assets in via `invest` (after having transferred them) and pulls
///         them out via `divest`. `totalAssets()` is the single source of truth for what the position
///         is worth in vault-asset units (USDC, 6 decimals).
interface IStrategyAdapter {
    /// @notice The vault-facing asset this adapter accounts in (USDC on Base Sepolia, 6 decimals).
    function asset() external view returns (IERC20);

    /// @notice The vault that owns this adapter and is its only privileged caller.
    function vault() external view returns (address);

    /// @notice Asset-denominated value of the position currently held by this adapter (6 decimals).
    /// @dev    For the testnet stubs this equals the adapter's own asset balance; a production adapter
    ///         would price its underlying (e.g. LBTC) into asset units here.
    function totalAssets() external view returns (uint256);

    /// @notice Deploy `amount` of asset already transferred into the adapter. Vault-only.
    /// @dev    The vault MUST transfer `amount` of asset to the adapter BEFORE calling `invest`
    ///         (checks-effects-interactions on the vault side). A stub simply acknowledges the inflow.
    /// @param amount Asset amount (6 decimals) now sitting in the adapter to be put to work.
    function invest(uint256 amount) external;

    /// @notice Withdraw up to `amount` of asset from the position back to the vault. Vault-only.
    /// @param amount Asset amount (6 decimals) requested.
    /// @return withdrawn Asset amount actually sent back to the vault (≤ `amount`).
    function divest(uint256 amount) external returns (uint256 withdrawn);
}
