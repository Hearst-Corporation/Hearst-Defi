// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BaseStrategyAdapter} from "./BaseStrategyAdapter.sol";

/// @title USDCReserveAdapter (B3 · Reserve)
/// @notice OPTIONAL adapter form of the B3 Reserve pocket (33% target). In the Mining Note layout B3 is
///         registered as an IDLE strategy (`adapter = address(0)`), satisfied by the vault's own idle
///         USDC — NOT by this adapter. This concrete adapter exists only for the flexible general mode
///         / tests that want a real B3 adapter. It is a plain USDC-custody stub like the others.
/// @dev    The vault treats an idle B3 (adapter == address(0)) as the reference; deploying this adapter
///         is a general-mode choice, not the Mining Note default.
contract USDCReserveAdapter is BaseStrategyAdapter {
    constructor(IERC20 asset_, address vault_) BaseStrategyAdapter(asset_, vault_) {}
}
