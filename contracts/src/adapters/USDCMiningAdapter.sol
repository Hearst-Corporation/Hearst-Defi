// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BaseStrategyAdapter} from "./BaseStrategyAdapter.sol";

/// @title USDCMiningAdapter (B1 · Mining Power)
/// @notice Testnet adapter for the B1 Mining Power pocket (40% target). Represents USDC deployed into
///         RWA mining power that generates BTC yield OFF-CHAIN. On-chain it simply custodies USDC; the
///         mining economics (hashrate, BTC earned) are reported to the vault via `reportMiningMetrics`,
///         not computed here. Non-idle: the vault pushes/pulls asset through `invest`/`divest`.
contract USDCMiningAdapter is BaseStrategyAdapter {
    constructor(IERC20 asset_, address vault_) BaseStrategyAdapter(asset_, vault_) {}
}
