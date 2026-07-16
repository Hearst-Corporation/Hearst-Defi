// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BaseStrategyAdapter} from "./BaseStrategyAdapter.sol";

/// @title LBTCPouchAdapter (B2 · BTC Pouch)
/// @notice Testnet adapter for the B2 BTC Pouch pocket (27% target). In production this holds LBTC and
///         prices it into asset units inside `totalAssets()`; on Base Sepolia it custodies USDC as a
///         stand-in so the accounting round-trips. BTC exposure / take-profit swaps are driven by the
///         vault keeper via `swapAndReport` (off-chain routed), not by this adapter. Non-idle.
contract LBTCPouchAdapter is BaseStrategyAdapter {
    constructor(IERC20 asset_, address vault_) BaseStrategyAdapter(asset_, vault_) {}
}
