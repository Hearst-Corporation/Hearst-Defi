// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IStrategyAdapter} from "./adapters/IStrategyAdapter.sol";

/// @title PermissionedDynaVault (v2.1)
/// @notice Permissioned, multi-pocket USDC vault for the Hearst Mining Note. Conforms EXACTLY to
///         `docs/VAULT_SPEC_V2.1.md` (source of truth): custom `deposit`/`redeem`/`redeemProportional`
///         surface, custom share bookkeeping (NON-transferable, NOT an ERC-20 share token — see #4 of
///         the product non-negotiables: no ERC-20 share wrapper until Cayman counsel), and the exact
///         event set of spec §4 (`Deposit` 3-param, `Redeem` shares-before-assets, etc).
///
///         Asset = USDC (6 decimals) on Base Sepolia (`0x036CbD…`, passed in — never hardcoded).
///         Shares are 6-decimal, 1:1 with asset at genesis (spec §9.0 decision recorded here:
///         SHARE-per-asset is 1:1, both 6 decimals — no 1e12 offset, unlike the legacy ERC-4626
///         `HearstYieldVault`). TESTNET ONLY — mainnet stays gated on the Spearbit audit.
///
///         Pockets (Mining Note Mode): B1 Mining 40% (adapter, non-idle), B2 BTC Pouch 27% (adapter,
///         non-idle), B3 Reserve 33% (idle, satisfied by the vault's own USDC balance). Idle assets =
///         asset held directly by the vault; non-idle assets = asset held by each adapter.
///
///         No on-chain yield logic, no auto-execution of strategies: mining metrics are REPORTED,
///         swaps are keeper-routed through an external DEX, rebalancing is keeper-triggered. Access is
///         a two-tier `owner` (config / strategy set) + `keeper` (operational engine). Reentrancy is
///         guarded on every asset-moving external entrypoint; state follows checks-effects-interactions.
contract PermissionedDynaVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ------------------------------------------------------------------ */
    /*                              constants                               */
    /* ------------------------------------------------------------------ */

    /// @notice Basis-point denominator (10000 = 100%).
    uint256 public constant BPS = 10_000;

    /// @notice Mining Note pocket count and target allocations (spec §6 / §2).
    uint256 private constant MINING_NOTE_POCKETS = 3;
    uint256 private constant B1_ALLOCATION_BPS = 4_000; // Mining Power (non-idle)
    uint256 private constant B2_ALLOCATION_BPS = 2_700; // BTC Pouch (non-idle)
    uint256 private constant B3_ALLOCATION_BPS = 3_300; // Reserve (idle)

    /// @notice Electricity payment cooldown (spec §2 / §8): 30 days.
    uint256 public constant ELEC_COOLDOWN = 30 days;

    /* ------------------------------------------------------------------ */
    /*                                types                                 */
    /* ------------------------------------------------------------------ */

    /// @notice A strategy pocket. `active` mirrors the spec's 3rd tuple slot; `isIdle == true` means
    ///         the allocation is satisfied by the vault's idle balance and `adapter == address(0)`.
    struct Strategy {
        address adapter; // address(0) iff idle
        uint256 allocation; // target weight in bps
        bool active; // registered / enabled
        bool isIdle; // satisfied by vault idle balance
    }

    /// @notice A take-profit tier: when reported BTC price ≥ `btcPrice`, sell `sellBps` of the BTC
    ///         pocket and lock proceeds into B3 (spec §2 `executeTakeProfit`).
    struct TakeProfitTier {
        uint256 btcPrice; // trigger price (0 = unset)
        uint256 sellBps; // fraction of B2 to sell, in bps
        bool set;
    }

    /* ------------------------------------------------------------------ */
    /*                                state                                */
    /* ------------------------------------------------------------------ */

    /// @notice Underlying asset — USDC on Base Sepolia (6 decimals). Immutable.
    IERC20 public immutable assetToken;

    /// @notice Operational bot allowed to run the engine (rebalance, swap, report, pay, take-profit).
    address public keeper;

    /// @notice Max total assets the vault will accept (0 = uncapped).
    uint256 public tvlCap;

    /// @notice When true, deposits are open to everyone (whitelist bypassed).
    bool public permissionDisabled;

    /// @notice Mining Note mode: enforces the exact 3-pocket 40/27/33 layout on `addStrategy`.
    bool public miningNoteMode;

    /// @notice Deposit whitelist.
    mapping(address => bool) public whitelist;

    /// @notice Share balance per user (6 decimals, non-transferable).
    mapping(address => uint256) public shares;

    /// @notice Total shares in circulation.
    uint256 public totalShares;

    /// @notice Registered strategy pockets, ordered (index 0 = B1, 1 = B2, 2 = B3 in Mining Note mode).
    Strategy[] private _strategies;

    /* ------------------------- mining / electricity ------------------------ */

    /// @notice Monthly electricity cost in asset units (6 decimals).
    uint256 public monthlyElecCost;

    /// @notice Recipient of the electricity payment.
    address public elecPayee;

    /// @notice Cumulative electricity paid.
    uint256 public totalElecPaid;

    /// @notice Timestamp of the last electricity payment (0 = never paid → first payment allowed).
    uint256 public lastElecPaymentTime;

    /// @notice Last reported hashrate (TH/s).
    uint256 public reportedHashrateTh;

    /// @notice Cumulative BTC earned, in satoshis.
    uint256 public totalBtcEarnedSats;

    /// @notice Timestamp of the last mining-metrics report.
    uint256 public lastMiningReportTime;

    /* --------------------------- engine parameters ------------------------- */

    /// @notice Month counter, incremented by `runMonthlyEngine`.
    uint256 public currentMonth;

    /// @notice True when B1 mining deposits are curtailed (emergency pause of the pocket).
    bool public isCurtailed;

    /// @notice Pre-halving curtailment BTC-price threshold (asset units).
    uint256 public curtailmentPreHalving;

    /// @notice Post-halving curtailment BTC-price threshold (asset units).
    uint256 public curtailmentPostHalving;

    /// @notice Expected halving month; selects which curtailment threshold applies.
    uint256 public halvingMonth;

    /// @notice Product duration in months (drives the B3 vending curve).
    uint256 public productDurationMonths;

    /// @notice Last BTC price observed by the engine (asset units), set on report / take-profit.
    uint256 public lastBtcPrice;

    /// @notice Take-profit tiers by index.
    mapping(uint256 => TakeProfitTier) private _takeProfitTiers;

    /* ------------------------------------------------------------------ */
    /*                               events (spec §4)                      */
    /* ------------------------------------------------------------------ */

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Redeem(address indexed user, uint256 shares, uint256 assets);
    event StrategyAdded(address indexed strategy, uint256 allocation);
    event StrategyRemoved(address indexed strategy);
    event Rebalance(uint256[] allocations);
    event VaultSwapped(
        address indexed caller, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut
    );
    event ElectricityPaid(uint256 amount, address indexed payee, uint256 timestamp);
    event ElecPayeeUpdated(address indexed oldPayee, address indexed newPayee);
    event MonthlyElecCostUpdated(uint256 oldCost, uint256 newCost);
    event MiningMetricsReported(
        uint256 hashrateTh, uint256 btcEarnedSats, uint256 totalBtcEarnedSats, uint256 timestamp
    );
    event CurtailmentTriggered(uint256 month, uint256 btcPrice, uint256 threshold);
    event CurtailmentLifted(uint256 month, uint256 btcPrice);
    event TakeProfitExecuted(uint256 indexed tier, uint256 btcPrice, uint256 btcSold, uint256 usdcReceived);
    event MonthlyEngineRun(uint256 month, bool fleetActive, uint256 btcPrice, uint256 elecPaid);

    /* -------------------------- non-spec admin events ---------------------- */
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event TvlCapUpdated(uint256 oldCap, uint256 newCap);
    event PermissionDisabledSet(bool disabled);
    event WhitelistUpdated(address indexed account, bool allowed);
    event MiningNoteModeSet(bool enabled);
    event CurtailmentThresholdsUpdated(uint256 preHalving, uint256 postHalving);
    event HalvingMonthUpdated(uint256 month);
    event TakeProfitTierUpdated(uint256 indexed index, uint256 btcPrice, uint256 sellBps);
    event TakeProfitTierReset(uint256 indexed index);
    event ProductDurationUpdated(uint256 months);
    event StrategyAllocationUpdated(uint256 indexed index, uint256 allocation);

    /* ------------------------------------------------------------------ */
    /*                                errors                               */
    /* ------------------------------------------------------------------ */

    error ZeroAddress();
    error ZeroAmount();
    error NotKeeper(address caller);
    error NotWhitelisted(address account);
    error TvlCapExceeded(uint256 attempted, uint256 cap);
    error InsufficientShares(uint256 have, uint256 want);
    error NotShareOwner();
    error NoShares();
    error IndexOutOfBounds(uint256 index);
    error StrategyNotFound(address adapter);
    error AllocationTooHigh(uint256 total);
    error MiningNoteLayoutViolation();
    error ElecPayeeUnset();
    error ElecCostUnset();
    error ElecCooldownActive(uint256 nextAllowed);
    error InsufficientIdle(uint256 have, uint256 want);
    error TierNotSet(uint256 index);
    error TakeProfitNotTriggered(uint256 tierPrice, uint256 lastPrice);

    /* ------------------------------------------------------------------ */
    /*                              modifiers                              */
    /* ------------------------------------------------------------------ */

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper(msg.sender);
        _;
    }

    /* ------------------------------------------------------------------ */
    /*                             constructor                             */
    /* ------------------------------------------------------------------ */

    /// @param asset_   Underlying asset (USDC on Base Sepolia — passed in, never hardcoded). Non-zero.
    /// @param owner_   Initial owner (manager multisig in prod; EOA on testnet). Non-zero.
    /// @param keeper_  Operational keeper bot. Non-zero.
    /// @param tvlCap_  Initial TVL cap in asset units (0 = uncapped).
    constructor(IERC20 asset_, address owner_, address keeper_, uint256 tvlCap_) Ownable(owner_) {
        if (address(asset_) == address(0) || keeper_ == address(0)) revert ZeroAddress();
        assetToken = asset_;
        keeper = keeper_;
        tvlCap = tvlCap_;
        productDurationMonths = 24; // spec §8 default; overridable by owner
        emit KeeperUpdated(address(0), keeper_);
        emit TvlCapUpdated(0, tvlCap_);
    }

    /* ================================================================== */
    /*                        1. USER FUNCTIONS                            */
    /* ================================================================== */

    /// @notice Deposit `assets` and receive shares. Whitelisted-only unless `permissionDisabled`.
    /// @dev    CEI: pull asset first, then mint shares, then allocate to non-idle pockets. 1:1 at
    ///         genesis; afterwards shares are minted pro-rata on the pre-deposit NAV.
    /// @param assets   Amount of asset to deposit (6 decimals).
    /// @param receiver Address credited with the shares.
    /// @return mintedShares Shares minted.
    function deposit(uint256 assets, address receiver)
        external
        nonReentrant
        returns (uint256 mintedShares)
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        if (!permissionDisabled && !whitelist[msg.sender]) revert NotWhitelisted(msg.sender);

        uint256 assetsBefore = totalAssets();
        if (tvlCap != 0 && assetsBefore + assets > tvlCap) {
            revert TvlCapExceeded(assetsBefore + assets, tvlCap);
        }

        // shares are priced on the NAV BEFORE this deposit lands (standard pro-rata).
        mintedShares = _convertToShares(assets, assetsBefore, totalShares);
        if (mintedShares == 0) revert ZeroAmount();

        // effects
        totalShares += mintedShares;
        shares[receiver] += mintedShares;

        // interaction: pull the asset in.
        assetToken.safeTransferFrom(msg.sender, address(this), assets);

        // allocate the fresh idle to non-idle pockets per their target weights.
        _allocateToPockets(assets);

        emit Deposit(receiver, assets, mintedShares);
    }

    /// @notice Redeem `shares` on behalf of `owner`, sending assets to `receiver`.
    /// @dev    CEI: burn shares first, then pull from idle, then from adapters, then transfer out.
    /// @param sharesToRedeem Shares to burn.
    /// @param receiver       Asset recipient.
    /// @param owner          Share owner (must be `msg.sender` — no allowance system in this phase).
    /// @return assets        Asset amount sent to `receiver`.
    function redeem(uint256 sharesToRedeem, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        assets = _redeem(sharesToRedeem, receiver, owner);
    }

    /// @notice Redeem ALL of the caller's shares in one transaction.
    /// @param receiver Asset recipient.
    /// @return assets  Asset amount sent to `receiver`.
    function redeemProportional(address receiver) external nonReentrant returns (uint256 assets) {
        uint256 bal = shares[msg.sender];
        if (bal == 0) revert NoShares();
        assets = _redeem(bal, receiver, msg.sender);
    }

    /* --------------------------- internal redeem --------------------------- */

    function _redeem(uint256 sharesToRedeem, address receiver, address owner) internal returns (uint256 assets) {
        if (sharesToRedeem == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        // No allowance model in this phase: only the owner can redeem their own shares.
        if (owner != msg.sender) revert NotShareOwner();

        uint256 bal = shares[owner];
        if (bal < sharesToRedeem) revert InsufficientShares(bal, sharesToRedeem);

        assets = _convertToAssets(sharesToRedeem, totalAssets(), totalShares);

        // effects: burn first.
        shares[owner] = bal - sharesToRedeem;
        totalShares -= sharesToRedeem;

        // gather liquidity: idle first, then divest adapters proportionally to the shortfall.
        _ensureIdle(assets);

        // interaction: pay out.
        assetToken.safeTransfer(receiver, assets);

        emit Redeem(owner, sharesToRedeem, assets);
    }

    /* ================================================================== */
    /*                     2. ADMIN / KEEPER FUNCTIONS                     */
    /* ================================================================== */

    /* -------------------------- strategy management ------------------------ */

    /// @notice Register a strategy pocket. Owner-only.
    /// @dev    In Mining Note mode the layout is enforced on the 3rd add: exactly B1 4000 non-idle,
    ///         B2 2700 non-idle, B3 3300 idle (spec §2). Idle pockets must pass `adapter == address(0)`.
    /// @param adapter    Adapter address (address(0) iff idle).
    /// @param allocation Target weight in bps.
    /// @param isIdle     Whether satisfied by the vault idle balance.
    function addStrategy(address adapter, uint256 allocation, bool isIdle) external onlyOwner {
        if (isIdle) {
            if (adapter != address(0)) revert MiningNoteLayoutViolation();
        } else {
            if (adapter == address(0)) revert ZeroAddress();
        }

        uint256 idx = _strategies.length;
        if (miningNoteMode) {
            _enforceMiningNoteLayout(idx, adapter, allocation, isIdle);
        } else {
            // general mode: total allocation must not exceed 100%.
            uint256 total = allocation;
            for (uint256 i = 0; i < _strategies.length; i++) {
                total += _strategies[i].allocation;
            }
            if (total > BPS) revert AllocationTooHigh(total);
        }

        _strategies.push(Strategy({adapter: adapter, allocation: allocation, active: true, isIdle: isIdle}));
        emit StrategyAdded(adapter, allocation);
    }

    /// @notice Remove a strategy by adapter address. Owner-only. Repatriates its assets to idle.
    /// @param adapter Adapter to remove (use address(0) to remove the idle pocket).
    function removeStrategy(address adapter) external onlyOwner nonReentrant {
        uint256 len = _strategies.length;
        for (uint256 i = 0; i < len; i++) {
            if (_strategies[i].adapter == adapter) {
                // pull all funds back from a non-idle adapter before dropping it.
                if (!_strategies[i].isIdle && adapter != address(0)) {
                    uint256 held = IStrategyAdapter(adapter).totalAssets();
                    if (held > 0) {
                        IStrategyAdapter(adapter).divest(held);
                    }
                }
                // swap-remove to keep the array compact.
                _strategies[i] = _strategies[len - 1];
                _strategies.pop();
                emit StrategyRemoved(adapter);
                return;
            }
        }
        revert StrategyNotFound(adapter);
    }

    /// @notice Adjust a pocket's target allocation. Keeper-only (BTC Strategic Reserve engine).
    /// @param index      Strategy index.
    /// @param allocation New target weight in bps.
    function setStrategyAllocation(uint256 index, uint256 allocation) external onlyKeeper {
        if (index >= _strategies.length) revert IndexOutOfBounds(index);
        uint256 total = allocation;
        for (uint256 i = 0; i < _strategies.length; i++) {
            if (i != index) total += _strategies[i].allocation;
        }
        if (total > BPS) revert AllocationTooHigh(total);
        _strategies[index].allocation = allocation;
        emit StrategyAllocationUpdated(index, allocation);
    }

    /* ------------------------------ rebalancing ---------------------------- */

    /// @notice Two-pass rebalance to target weights. Keeper-only.
    /// @dev    Pass 1 (withdraw): divest over-weight non-idle pockets back to idle. Pass 2 (deposit):
    ///         push idle into under-weight non-idle pockets. Idle pockets (B3) are satisfied by whatever
    ///         idle remains. CEI is respected inside `_allocateToPockets` / adapter divests.
    function rebalance() external onlyKeeper nonReentrant {
        _rebalance();
    }

    function _rebalance() internal {
        uint256 len = _strategies.length;
        uint256 nav = totalAssets();

        // Pass 1: withdraw the excess of over-weight non-idle pockets into idle.
        for (uint256 i = 0; i < len; i++) {
            Strategy memory s = _strategies[i];
            if (s.isIdle || s.adapter == address(0) || !s.active) continue;
            uint256 target = (nav * s.allocation) / BPS;
            uint256 held = IStrategyAdapter(s.adapter).totalAssets();
            if (held > target) {
                IStrategyAdapter(s.adapter).divest(held - target);
            }
        }

        // Pass 2: push idle into under-weight non-idle pockets.
        for (uint256 i = 0; i < len; i++) {
            Strategy memory s = _strategies[i];
            if (s.isIdle || s.adapter == address(0) || !s.active) continue;
            // Curtailment freezes new B1 (mining) deposits.
            if (isCurtailed && s.allocation == B1_ALLOCATION_BPS && _isB1(i)) continue;
            uint256 target = (nav * s.allocation) / BPS;
            uint256 held = IStrategyAdapter(s.adapter).totalAssets();
            if (target > held) {
                uint256 need = target - held;
                uint256 idle = _idleBalance();
                uint256 push = need > idle ? idle : need;
                if (push > 0) {
                    assetToken.safeTransfer(s.adapter, push);
                    IStrategyAdapter(s.adapter).invest(push);
                }
            }
        }

        emit Rebalance(_allocationsSnapshot());
    }

    /// @notice Swap `amountIn` of `tokenIn` for `tokenOut` via an external router, then rebalance.
    /// @dev    Keeper-only. The router pulls `tokenIn` (approved here) and sends `tokenOut` back to the
    ///         vault; `minAmountOut` bounds slippage. `swapData` is the opaque calldata payload (kept as
    ///         `bytes32[]` per spec §9.5). This is the ONLY external-call path with a variable target:
    ///         nonReentrant + CEI + a hard `minAmountOut` output check protect it.
    /// @param tokenIn        Token sold (e.g. LBTC).
    /// @param amountIn       Amount sold.
    /// @param tokenOut       Token bought (e.g. USDC asset).
    /// @param minAmountOut   Minimum acceptable output (slippage guard).
    /// @param selectedRouter External DEX router to call.
    /// @param swapData       Opaque router calldata payload (spec §9.5: bytes32[]).
    function swapAndReport(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 minAmountOut,
        address selectedRouter,
        bytes32[] calldata swapData
    ) external onlyKeeper nonReentrant {
        if (selectedRouter == address(0) || tokenIn == address(0) || tokenOut == address(0)) {
            revert ZeroAddress();
        }
        if (amountIn == 0) revert ZeroAmount();

        uint256 outBefore = IERC20(tokenOut).balanceOf(address(this));

        // approve exactly amountIn, call the router, then reset approval (defensive).
        IERC20(tokenIn).forceApprove(selectedRouter, amountIn);
        _routerCall(selectedRouter, swapData);
        IERC20(tokenIn).forceApprove(selectedRouter, 0);

        uint256 received = IERC20(tokenOut).balanceOf(address(this)) - outBefore;
        if (received < minAmountOut) revert TakeProfitNotTriggered(received, minAmountOut);

        emit VaultSwapped(msg.sender, tokenIn, tokenOut, amountIn, received);

        // realign pockets after the swap.
        _rebalance();
    }

    /// @dev Isolated low-level router call. `swapData` (bytes32[]) is flattened to calldata.
    function _routerCall(address router, bytes32[] calldata swapData) internal {
        bytes memory payload = abi.encodePacked(swapData);
        (bool ok,) = router.call(payload);
        require(ok, "router call failed");
    }

    /* --------------------------- electricity payment ----------------------- */

    /// @notice Pay the monthly electricity bill from idle (B3). Keeper-only.
    /// @dev    Requires payee + cost set, cooldown elapsed, and idle ≥ cost. CEI: set timestamp before
    ///         transferring out.
    function payElectricity() external onlyKeeper nonReentrant {
        _payElectricity();
    }

    function _payElectricity() internal returns (uint256 paid) {
        if (elecPayee == address(0)) revert ElecPayeeUnset();
        if (monthlyElecCost == 0) revert ElecCostUnset();
        uint256 nextAllowed = lastElecPaymentTime == 0 ? 0 : lastElecPaymentTime + ELEC_COOLDOWN;
        if (block.timestamp < nextAllowed) revert ElecCooldownActive(nextAllowed);

        uint256 idle = _idleBalance();
        if (idle < monthlyElecCost) revert InsufficientIdle(idle, monthlyElecCost);

        paid = monthlyElecCost;
        // effects
        lastElecPaymentTime = block.timestamp;
        totalElecPaid += paid;

        // interaction
        assetToken.safeTransfer(elecPayee, paid);
        emit ElectricityPaid(paid, elecPayee, block.timestamp);
    }

    /* ---------------------------- mining metrics --------------------------- */

    /// @notice Report hashrate and BTC earned from the external pool. Keeper-only.
    /// @param hashrateTh    Current hashrate (TH/s).
    /// @param btcEarnedSats Newly earned BTC (satoshis) since the last report.
    function reportMiningMetrics(uint256 hashrateTh, uint256 btcEarnedSats) external onlyKeeper {
        reportedHashrateTh = hashrateTh;
        totalBtcEarnedSats += btcEarnedSats;
        lastMiningReportTime = block.timestamp;
        emit MiningMetricsReported(hashrateTh, btcEarnedSats, totalBtcEarnedSats, block.timestamp);
    }

    /* --------------------------- monthly engine ---------------------------- */

    /// @notice Advance the month: increment counter, evaluate curtailment, pay electricity (best
    ///         effort), then rebalance. Keeper-only.
    /// @param btcPrice Current BTC price (asset units) used for the curtailment check.
    function runMonthlyEngine(uint256 btcPrice) external onlyKeeper nonReentrant {
        currentMonth += 1;
        lastBtcPrice = btcPrice;

        uint256 threshold = _activeCurtailmentThreshold();
        if (threshold != 0) {
            if (btcPrice < threshold && !isCurtailed) {
                isCurtailed = true;
                emit CurtailmentTriggered(currentMonth, btcPrice, threshold);
            } else if (btcPrice >= threshold && isCurtailed) {
                isCurtailed = false;
                emit CurtailmentLifted(currentMonth, btcPrice);
            }
        }

        // best-effort electricity payment (never reverts the whole engine on a cooldown/idle miss).
        uint256 elecPaid = 0;
        if (elecPayee != address(0) && monthlyElecCost != 0) {
            uint256 nextAllowed = lastElecPaymentTime == 0 ? 0 : lastElecPaymentTime + ELEC_COOLDOWN;
            if (block.timestamp >= nextAllowed && _idleBalance() >= monthlyElecCost) {
                elecPaid = _payElectricity();
            }
        }

        _rebalance();

        emit MonthlyEngineRun(currentMonth, !isCurtailed, btcPrice, elecPaid);
    }

    /// @notice Emergency-curtail B1 mining deposits. Owner or keeper.
    function curtail() external {
        if (msg.sender != owner() && msg.sender != keeper) revert NotKeeper(msg.sender);
        isCurtailed = true;
        emit CurtailmentTriggered(currentMonth, lastBtcPrice, _activeCurtailmentThreshold());
    }

    /// @notice Lift the curtailment. Owner or keeper.
    function liftCurtailment() external {
        if (msg.sender != owner() && msg.sender != keeper) revert NotKeeper(msg.sender);
        isCurtailed = false;
        emit CurtailmentLifted(currentMonth, lastBtcPrice);
    }

    /// @notice Execute a take-profit tier: sell part of the BTC pocket, lock proceeds into B3. Keeper.
    /// @dev    Testnet accounting stub — records the event and moves the modeled proceeds from the B2
    ///         adapter into idle (B3). Real BTC sale is keeper-routed off-chain via `swapAndReport`.
    /// @param tierIndex Tier to execute.
    function executeTakeProfit(uint256 tierIndex) external onlyKeeper nonReentrant {
        TakeProfitTier memory tier = _takeProfitTiers[tierIndex];
        if (!tier.set) revert TierNotSet(tierIndex);
        if (lastBtcPrice < tier.btcPrice) revert TakeProfitNotTriggered(tier.btcPrice, lastBtcPrice);

        // model: sell `sellBps` of the B2 pocket value into idle (B3).
        uint256 b2Value = _b2Value();
        uint256 usdcReceived = (b2Value * tier.sellBps) / BPS;
        if (usdcReceived > 0) {
            address b2 = _b2Adapter();
            if (b2 != address(0)) {
                IStrategyAdapter(b2).divest(usdcReceived);
            }
        }

        emit TakeProfitExecuted(tierIndex, tier.btcPrice, usdcReceived, usdcReceived);
    }

    /* ------------------------------ admin config --------------------------- */

    function setElecPayee(address _payee) external onlyOwner {
        if (_payee == address(0)) revert ZeroAddress();
        address old = elecPayee;
        elecPayee = _payee;
        emit ElecPayeeUpdated(old, _payee);
    }

    function setMonthlyElecCost(uint256 _cost) external onlyOwner {
        uint256 old = monthlyElecCost;
        monthlyElecCost = _cost;
        emit MonthlyElecCostUpdated(old, _cost);
    }

    function setKeeper(address _keeper) external onlyOwner {
        if (_keeper == address(0)) revert ZeroAddress();
        address old = keeper;
        keeper = _keeper;
        emit KeeperUpdated(old, _keeper);
    }

    function setTvlCap(uint256 newCap) external onlyOwner {
        uint256 old = tvlCap;
        tvlCap = newCap;
        emit TvlCapUpdated(old, newCap);
    }

    function setPermissionDisabled(bool disabled) external onlyOwner {
        permissionDisabled = disabled;
        emit PermissionDisabledSet(disabled);
    }

    function addToWhitelist(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        whitelist[account] = true;
        emit WhitelistUpdated(account, true);
    }

    function removeFromWhitelist(address account) external onlyOwner {
        whitelist[account] = false;
        emit WhitelistUpdated(account, false);
    }

    function setMiningNoteMode(bool enabled) external onlyOwner {
        miningNoteMode = enabled;
        emit MiningNoteModeSet(enabled);
    }

    function setCurtailmentThresholds(uint256 pre, uint256 post) external onlyOwner {
        curtailmentPreHalving = pre;
        curtailmentPostHalving = post;
        emit CurtailmentThresholdsUpdated(pre, post);
    }

    function setHalvingMonth(uint256 month) external onlyOwner {
        halvingMonth = month;
        emit HalvingMonthUpdated(month);
    }

    function setTakeProfitTier(uint256 index, uint256 btcPrice, uint256 sellBps) external onlyOwner {
        if (sellBps > BPS) revert AllocationTooHigh(sellBps);
        _takeProfitTiers[index] = TakeProfitTier({btcPrice: btcPrice, sellBps: sellBps, set: true});
        emit TakeProfitTierUpdated(index, btcPrice, sellBps);
    }

    function resetTakeProfitTier(uint256 index) external onlyOwner {
        delete _takeProfitTiers[index];
        emit TakeProfitTierReset(index);
    }

    function setProductDurationMonths(uint256 months) external onlyOwner {
        productDurationMonths = months;
        emit ProductDurationUpdated(months);
    }

    /* ================================================================== */
    /*                       3. VIEW FUNCTIONS (spec §3)                  */
    /* ================================================================== */

    /// @notice Total assets = idle (held by the vault) + sum of non-idle adapter values.
    function totalAssets() public view returns (uint256 total) {
        total = _idleBalance();
        uint256 len = _strategies.length;
        for (uint256 i = 0; i < len; i++) {
            Strategy storage s = _strategies[i];
            if (!s.isIdle && s.adapter != address(0)) {
                total += IStrategyAdapter(s.adapter).totalAssets();
            }
        }
    }

    /// @notice Asset → shares at the current NAV.
    function convertToShares(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, totalAssets(), totalShares);
    }

    /// @notice Shares → assets at the current NAV.
    function convertToAssets(uint256 sharesAmount) external view returns (uint256) {
        return _convertToAssets(sharesAmount, totalAssets(), totalShares);
    }

    /// @notice Number of registered strategy pockets.
    function getStrategyCount() external view returns (uint256) {
        return _strategies.length;
    }

    /// @notice Strategy tuple: (adapter, allocation, active, isIdle) — spec §3 order.
    function strategies(uint256 index)
        external
        view
        returns (address adapter, uint256 allocation, bool active, bool isIdle)
    {
        if (index >= _strategies.length) revert IndexOutOfBounds(index);
        Strategy storage s = _strategies[index];
        return (s.adapter, s.allocation, s.active, s.isIdle);
    }

    /// @notice Electricity status: (cost, payee, totalPaid, lastPaymentTime, canPay) — spec §3.
    /// @dev    `canPay` = payee & cost set, cooldown elapsed, idle ≥ cost.
    function elecStatus()
        external
        view
        returns (uint256 cost, address payee, uint256 totalPaid, uint256 lastPaymentTime, bool canPay)
    {
        cost = monthlyElecCost;
        payee = elecPayee;
        totalPaid = totalElecPaid;
        lastPaymentTime = lastElecPaymentTime;
        bool cooldownOk =
            lastElecPaymentTime == 0 ? true : block.timestamp >= lastElecPaymentTime + ELEC_COOLDOWN;
        canPay = payee != address(0) && cost != 0 && cooldownOk && _idleBalance() >= cost;
    }

    /// @notice Mining metrics: (hashrateTh, totalBtcEarnedSats, lastReportTime) — spec §3.
    function miningMetrics()
        external
        view
        returns (uint256 hashrateTh, uint256 totalBtc, uint256 lastReportTime)
    {
        return (reportedHashrateTh, totalBtcEarnedSats, lastMiningReportTime);
    }

    /// @notice Asset (USDC) address. Named `asset()` per spec §3.
    function asset() external view returns (address) {
        return address(assetToken);
    }

    /// @notice B3 vending curve: the fraction (bps) of the electricity bill still covered in asset at
    ///         `month`. `1 - month/duration`, clamped to [0, 10000] (spec §7).
    function vendingCurveBps(uint256 month) external view returns (uint256) {
        uint256 dur = productDurationMonths;
        if (dur == 0 || month >= dur) return 0;
        return BPS - (month * BPS) / dur;
    }

    /// @notice Read a take-profit tier: (btcPrice, sellBps, set).
    function takeProfitTiers(uint256 index) external view returns (uint256 btcPrice, uint256 sellBps, bool set) {
        TakeProfitTier storage t = _takeProfitTiers[index];
        return (t.btcPrice, t.sellBps, t.set);
    }

    /* ================================================================== */
    /*                       internal accounting                          */
    /* ================================================================== */

    /// @dev Idle = asset held directly by the vault (this is the B3 reserve pool).
    function _idleBalance() internal view returns (uint256) {
        return assetToken.balanceOf(address(this));
    }

    /// @dev Shares for `assets` on a vault whose NAV is `assetsTotal` with `sharesTotal` outstanding.
    ///      1:1 (6-decimal) when empty; pro-rata (round down) otherwise.
    function _convertToShares(uint256 assets, uint256 assetsTotal, uint256 sharesTotal)
        internal
        pure
        returns (uint256)
    {
        if (sharesTotal == 0 || assetsTotal == 0) return assets; // genesis 1:1 (both 6 decimals)
        return Math.mulDiv(assets, sharesTotal, assetsTotal, Math.Rounding.Floor);
    }

    /// @dev Assets for `sharesAmount`; round down (in the vault's favour).
    function _convertToAssets(uint256 sharesAmount, uint256 assetsTotal, uint256 sharesTotal)
        internal
        pure
        returns (uint256)
    {
        if (sharesTotal == 0) return sharesAmount; // symmetric genesis 1:1
        return Math.mulDiv(sharesAmount, assetsTotal, sharesTotal, Math.Rounding.Floor);
    }

    /// @dev Allocate fresh idle `amount` to non-idle pockets by target weight (deposit-time push).
    ///      Respects curtailment for B1. Any remainder stays idle (that IS the B3 reserve).
    function _allocateToPockets(uint256 amount) internal {
        uint256 len = _strategies.length;
        for (uint256 i = 0; i < len; i++) {
            Strategy memory s = _strategies[i];
            if (s.isIdle || s.adapter == address(0) || !s.active) continue;
            if (isCurtailed && _isB1(i)) continue; // no new mining deposits while curtailed
            uint256 push = (amount * s.allocation) / BPS;
            uint256 idle = _idleBalance();
            if (push > idle) push = idle;
            if (push > 0) {
                assetToken.safeTransfer(s.adapter, push);
                IStrategyAdapter(s.adapter).invest(push);
            }
        }
    }

    /// @dev Make at least `needed` asset available as idle by divesting non-idle adapters in order.
    function _ensureIdle(uint256 needed) internal {
        uint256 idle = _idleBalance();
        if (idle >= needed) return;
        uint256 shortfall = needed - idle;

        uint256 len = _strategies.length;
        for (uint256 i = 0; i < len && shortfall > 0; i++) {
            Strategy memory s = _strategies[i];
            if (s.isIdle || s.adapter == address(0) || !s.active) continue;
            uint256 got = IStrategyAdapter(s.adapter).divest(shortfall);
            shortfall = got >= shortfall ? 0 : shortfall - got;
        }
        // If still short after divesting everything, the transfer below reverts on insufficient balance
        // (SafeERC20) — an honest failure, never a silent short-pay.
    }

    /// @dev Enforce the exact Mining Note 3-pocket layout at each `addStrategy` call.
    function _enforceMiningNoteLayout(uint256 idx, address adapter, uint256 allocation, bool isIdle)
        internal
        pure
    {
        if (idx >= MINING_NOTE_POCKETS) revert MiningNoteLayoutViolation();
        if (idx == 0) {
            // B1: 4000 bps, non-idle, adapter set.
            if (allocation != B1_ALLOCATION_BPS || isIdle || adapter == address(0)) {
                revert MiningNoteLayoutViolation();
            }
        } else if (idx == 1) {
            // B2: 2700 bps, non-idle, adapter set.
            if (allocation != B2_ALLOCATION_BPS || isIdle || adapter == address(0)) {
                revert MiningNoteLayoutViolation();
            }
        } else {
            // B3: 3300 bps, idle, no adapter.
            if (allocation != B3_ALLOCATION_BPS || !isIdle || adapter != address(0)) {
                revert MiningNoteLayoutViolation();
            }
        }
    }

    /// @dev B1 is index 0 in the Mining Note layout; in general mode we treat index 0 similarly.
    function _isB1(uint256 index) internal pure returns (bool) {
        return index == 0;
    }

    /// @dev Value held in the B2 (BTC pouch) pocket — index 1 in the Mining Note layout.
    function _b2Value() internal view returns (uint256) {
        if (_strategies.length < 2) return 0;
        Strategy storage s = _strategies[1];
        if (s.isIdle || s.adapter == address(0)) return 0;
        return IStrategyAdapter(s.adapter).totalAssets();
    }

    /// @dev B2 adapter address (index 1), or address(0) if absent.
    function _b2Adapter() internal view returns (address) {
        if (_strategies.length < 2) return address(0);
        return _strategies[1].adapter;
    }

    /// @dev Snapshot of current allocations for the Rebalance event.
    function _allocationsSnapshot() internal view returns (uint256[] memory out) {
        uint256 len = _strategies.length;
        out = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = _strategies[i].allocation;
        }
    }

    /// @dev Curtailment threshold in force given the current month vs the halving month.
    function _activeCurtailmentThreshold() internal view returns (uint256) {
        if (halvingMonth != 0 && currentMonth >= halvingMonth) {
            return curtailmentPostHalving;
        }
        return curtailmentPreHalving;
    }
}
