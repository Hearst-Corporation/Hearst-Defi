// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PermissionedDynaVault} from "../src/PermissionedDynaVault.sol";
import {IStrategyAdapter} from "../src/adapters/IStrategyAdapter.sol";
import {USDCMiningAdapter} from "../src/adapters/USDCMiningAdapter.sol";
import {LBTCPouchAdapter} from "../src/adapters/LBTCPouchAdapter.sol";

/// @dev Minimal 6-decimal mock standing in for USDC on Base Sepolia.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PermissionedDynaVaultTest is Test {
    MockUSDC internal usdc;
    PermissionedDynaVault internal vault;
    USDCMiningAdapter internal b1;
    LBTCPouchAdapter internal b2;

    address internal owner = makeAddr("owner");
    address internal keeper = makeAddr("keeper");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");
    address internal payee = makeAddr("payee");

    uint256 internal constant ONE_USDC = 1e6;
    uint256 internal constant TVL_CAP = 10_000_000 * ONE_USDC;

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Redeem(address indexed user, uint256 shares, uint256 assets);
    event ElectricityPaid(uint256 amount, address indexed payee, uint256 timestamp);
    event MiningMetricsReported(
        uint256 hashrateTh, uint256 btcEarnedSats, uint256 totalBtcEarnedSats, uint256 timestamp
    );
    event TakeProfitExecuted(uint256 indexed tier, uint256 btcPrice, uint256 btcSold, uint256 usdcReceived);
    event CurtailmentTriggered(uint256 month, uint256 btcPrice, uint256 threshold);
    event CurtailmentLifted(uint256 month, uint256 btcPrice);

    function setUp() public {
        usdc = new MockUSDC();
        vault = new PermissionedDynaVault(IERC20(address(usdc)), owner, keeper, TVL_CAP);

        b1 = new USDCMiningAdapter(IERC20(address(usdc)), address(vault));
        b2 = new LBTCPouchAdapter(IERC20(address(usdc)), address(vault));

        // Mining Note layout: B1 4000 non-idle, B2 2700 non-idle, B3 3300 idle.
        vm.startPrank(owner);
        vault.setMiningNoteMode(true);
        vault.addStrategy(address(b1), 4_000, false);
        vault.addStrategy(address(b2), 2_700, false);
        vault.addStrategy(address(0), 3_300, true);
        vault.addToWhitelist(alice);
        vault.addToWhitelist(bob);
        vm.stopPrank();

        usdc.mint(alice, 5_000_000 * ONE_USDC);
        usdc.mint(bob, 5_000_000 * ONE_USDC);

        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    /* ------------------------------- constructor ------------------------------ */

    function test_constructor_wiring() public view {
        assertEq(vault.asset(), address(usdc));
        assertEq(vault.owner(), owner);
        assertEq(vault.keeper(), keeper);
        assertEq(vault.tvlCap(), TVL_CAP);
        assertEq(vault.totalShares(), 0);
        assertEq(vault.totalAssets(), 0);
        assertEq(vault.getStrategyCount(), 3);
        assertTrue(vault.miningNoteMode());
        assertEq(vault.productDurationMonths(), 24);
    }

    function test_constructor_revertsOnZeroAsset() public {
        vm.expectRevert(PermissionedDynaVault.ZeroAddress.selector);
        new PermissionedDynaVault(IERC20(address(0)), owner, keeper, 0);
    }

    function test_constructor_revertsOnZeroKeeper() public {
        vm.expectRevert(PermissionedDynaVault.ZeroAddress.selector);
        new PermissionedDynaVault(IERC20(address(usdc)), owner, address(0), 0);
    }

    /* --------------------------------- deposit -------------------------------- */

    function test_deposit_genesisMintsOneToOneAndAllocates() public {
        uint256 amount = 1_000 * ONE_USDC;

        vm.expectEmit(true, false, false, true, address(vault));
        emit Deposit(alice, amount, amount); // 1:1 at genesis, 6 dec

        vm.prank(alice);
        uint256 s = vault.deposit(amount, alice);

        assertEq(s, amount);
        assertEq(vault.shares(alice), amount);
        assertEq(vault.totalShares(), amount);
        assertEq(vault.totalAssets(), amount);

        // 40% to B1, 27% to B2, 33% stays idle (B3).
        assertEq(b1.totalAssets(), (amount * 4_000) / 10_000);
        assertEq(b2.totalAssets(), (amount * 2_700) / 10_000);
        assertEq(usdc.balanceOf(address(vault)), (amount * 3_300) / 10_000);
    }

    function test_deposit_revertsForNonWhitelisted() public {
        usdc.mint(stranger, 1_000 * ONE_USDC);
        vm.prank(stranger);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotWhitelisted.selector, stranger));
        vault.deposit(1_000 * ONE_USDC, stranger);
    }

    function test_deposit_openWhenPermissionDisabled() public {
        vm.prank(owner);
        vault.setPermissionDisabled(true);

        usdc.mint(stranger, 1_000 * ONE_USDC);
        vm.prank(stranger);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(stranger);
        uint256 s = vault.deposit(1_000 * ONE_USDC, stranger);
        assertEq(s, 1_000 * ONE_USDC);
    }

    function test_deposit_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(PermissionedDynaVault.ZeroAmount.selector);
        vault.deposit(0, alice);
    }

    function test_deposit_revertsWhenTvlCapExceeded() public {
        vm.prank(owner);
        vault.setTvlCap(1_000 * ONE_USDC);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedDynaVault.TvlCapExceeded.selector, 1_000 * ONE_USDC + 1, 1_000 * ONE_USDC
            )
        );
        vault.deposit(1_000 * ONE_USDC + 1, alice);
    }

    /* ---------------------------------- redeem -------------------------------- */

    function test_redeem_roundTripReturnsPrincipal() public {
        uint256 amount = 100_000 * ONE_USDC;
        vm.prank(alice);
        uint256 s = vault.deposit(amount, alice);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.expectEmit(true, false, false, true, address(vault));
        emit Redeem(alice, s, amount);
        vm.prank(alice);
        uint256 out = vault.redeem(s, alice, alice);

        assertEq(out, amount);
        assertEq(usdc.balanceOf(alice), balBefore + amount);
        assertEq(vault.shares(alice), 0);
        assertEq(vault.totalShares(), 0);
    }

    function test_redeem_pullsFromAdaptersWhenIdleInsufficient() public {
        uint256 amount = 100_000 * ONE_USDC;
        vm.prank(alice);
        uint256 s = vault.deposit(amount, alice);

        // idle (B3) is only 33% — redeeming 100% forces divesting B1 and B2.
        vm.prank(alice);
        uint256 out = vault.redeem(s, alice, alice);
        assertEq(out, amount);
        assertEq(b1.totalAssets(), 0);
        assertEq(b2.totalAssets(), 0);
    }

    function test_redeem_revertsForNonOwnerCaller() public {
        vm.prank(alice);
        uint256 s = vault.deposit(100_000 * ONE_USDC, alice);
        vm.prank(bob);
        vm.expectRevert(PermissionedDynaVault.NotShareOwner.selector);
        vault.redeem(s, bob, alice);
    }

    function test_redeem_revertsOnInsufficientShares() public {
        vm.prank(alice);
        uint256 s = vault.deposit(100_000 * ONE_USDC, alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.InsufficientShares.selector, s, s + 1));
        vault.redeem(s + 1, alice, alice);
    }

    function test_redeemProportional_redeemsAll() public {
        uint256 amount = 100_000 * ONE_USDC;
        vm.prank(alice);
        vault.deposit(amount, alice);
        vm.prank(alice);
        uint256 out = vault.redeemProportional(alice);
        assertEq(out, amount);
        assertEq(vault.shares(alice), 0);
    }

    function test_redeemProportional_revertsWithNoShares() public {
        vm.prank(alice);
        vm.expectRevert(PermissionedDynaVault.NoShares.selector);
        vault.redeemProportional(alice);
    }

    /* --------------------- multi-depositor pro-rata + yield ------------------- */

    function test_twoDepositors_shareValueTracksNav() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE_USDC, alice);

        // simulate off-chain yield delivered as USDC into B1 adapter.
        uint256 yield = 10_000 * ONE_USDC;
        usdc.mint(address(b1), yield);

        // bob deposits after NAV grew: he gets fewer shares per USDC.
        vm.prank(bob);
        uint256 bobShares = vault.deposit(100_000 * ONE_USDC, bob);
        assertLt(bobShares, 100_000 * ONE_USDC);

        // alice can now redeem more than she put in (she owns a slice of the yield).
        uint256 aliceAssets = vault.convertToAssets(vault.shares(alice));
        assertGt(aliceAssets, 100_000 * ONE_USDC);
    }

    /* ------------------------------- whitelist -------------------------------- */

    function test_whitelist_addRemove() public {
        assertTrue(vault.whitelist(alice));
        vm.prank(owner);
        vault.removeFromWhitelist(alice);
        assertFalse(vault.whitelist(alice));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotWhitelisted.selector, alice));
        vault.deposit(1_000 * ONE_USDC, alice);
    }

    function test_whitelist_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.addToWhitelist(stranger);
    }

    /* --------------------------- strategy management -------------------------- */

    function test_miningNoteLayout_enforcesExactWeights() public {
        PermissionedDynaVault v = new PermissionedDynaVault(IERC20(address(usdc)), owner, keeper, 0);
        vm.prank(owner);
        v.setMiningNoteMode(true);
        USDCMiningAdapter a = new USDCMiningAdapter(IERC20(address(usdc)), address(v));
        // Wrong B1 weight reverts.
        vm.prank(owner);
        vm.expectRevert(PermissionedDynaVault.MiningNoteLayoutViolation.selector);
        v.addStrategy(address(a), 5_000, false);
    }

    function test_miningNoteLayout_rejectsFourthStrategy() public {
        USDCMiningAdapter a = new USDCMiningAdapter(IERC20(address(usdc)), address(vault));
        vm.prank(owner);
        vm.expectRevert(PermissionedDynaVault.MiningNoteLayoutViolation.selector);
        vault.addStrategy(address(a), 1, false);
    }

    function test_removeStrategy_repatriatesFunds() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE_USDC, alice);
        assertGt(b1.totalAssets(), 0);
        vm.prank(owner);
        vault.removeStrategy(address(b1));
        assertEq(b1.totalAssets(), 0);
        assertEq(vault.getStrategyCount(), 2);
    }

    function test_removeStrategy_revertsWhenNotFound() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.StrategyNotFound.selector, address(0xdead)));
        vault.removeStrategy(address(0xdead));
    }

    function test_setStrategyAllocation_keeperOnly() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotKeeper.selector, stranger));
        vault.setStrategyAllocation(0, 1_000);

        vm.prank(keeper);
        vault.setStrategyAllocation(0, 3_500);
        (, uint256 alloc,,) = vault.strategies(0);
        assertEq(alloc, 3_500);
    }

    /* ------------------------------- rebalancing ------------------------------ */

    function test_rebalance_restoresTargetWeights() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE_USDC, alice);

        // drift: someone sends extra USDC straight into B1 (simulated over-weight).
        usdc.mint(address(b1), 50_000 * ONE_USDC);

        vm.prank(keeper);
        vault.rebalance();

        uint256 nav = vault.totalAssets();
        // B1 should be back near 40% of NAV (integer rounding tolerance).
        assertApproxEqAbs(b1.totalAssets(), (nav * 4_000) / 10_000, 2);
        assertApproxEqAbs(b2.totalAssets(), (nav * 2_700) / 10_000, 2);
    }

    function test_rebalance_keeperOnly() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotKeeper.selector, stranger));
        vault.rebalance();
    }

    /* ------------------------------- electricity ------------------------------ */

    function _fundIdle(uint256 amount) internal {
        // deposit with permission open so idle (B3) holds enough to pay.
        vm.prank(alice);
        vault.deposit(amount, alice);
    }

    function test_payElectricity_paysAndRespectsCooldown() public {
        _fundIdle(1_000_000 * ONE_USDC); // 33% idle = 330k USDC

        vm.startPrank(owner);
        vault.setElecPayee(payee);
        vault.setMonthlyElecCost(16_408 * ONE_USDC);
        vm.stopPrank();

        (,,,, bool canPay) = vault.elecStatus();
        assertTrue(canPay);

        uint256 before = usdc.balanceOf(payee);
        vm.expectEmit(true, false, false, false, address(vault));
        emit ElectricityPaid(16_408 * ONE_USDC, payee, block.timestamp);
        vm.prank(keeper);
        vault.payElectricity();

        assertEq(usdc.balanceOf(payee), before + 16_408 * ONE_USDC);
        assertEq(vault.totalElecPaid(), 16_408 * ONE_USDC);

        // cooldown active: second immediate payment reverts.
        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedDynaVault.ElecCooldownActive.selector, block.timestamp + 30 days
            )
        );
        vault.payElectricity();

        // warp 30 days: allowed again.
        vm.warp(block.timestamp + 30 days);
        vm.prank(keeper);
        vault.payElectricity();
        assertEq(vault.totalElecPaid(), 2 * 16_408 * ONE_USDC);
    }

    function test_payElectricity_revertsIfPayeeUnset() public {
        _fundIdle(1_000_000 * ONE_USDC);
        vm.prank(owner);
        vault.setMonthlyElecCost(16_408 * ONE_USDC);
        vm.prank(keeper);
        vm.expectRevert(PermissionedDynaVault.ElecPayeeUnset.selector);
        vault.payElectricity();
    }

    function test_payElectricity_keeperOnly() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotKeeper.selector, stranger));
        vault.payElectricity();
    }

    /* ------------------------------ mining metrics ---------------------------- */

    function test_reportMiningMetrics_accumulates() public {
        vm.expectEmit(false, false, false, true, address(vault));
        emit MiningMetricsReported(500, 10_000, 10_000, block.timestamp);
        vm.prank(keeper);
        vault.reportMiningMetrics(500, 10_000);

        vm.prank(keeper);
        vault.reportMiningMetrics(600, 5_000);

        (uint256 hr, uint256 totalBtc, uint256 last) = vault.miningMetrics();
        assertEq(hr, 600);
        assertEq(totalBtc, 15_000);
        assertEq(last, block.timestamp);
        assertEq(vault.reportedHashrateTh(), 600);
        assertEq(vault.totalBtcEarnedSats(), 15_000);
    }

    function test_reportMiningMetrics_keeperOnly() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotKeeper.selector, stranger));
        vault.reportMiningMetrics(1, 1);
    }

    /* ------------------------------- take-profit ------------------------------ */

    function test_executeTakeProfit_sellsB2IntoIdle() public {
        _fundIdle(100_000 * ONE_USDC);
        uint256 b2Before = b2.totalAssets();
        assertGt(b2Before, 0);

        vm.prank(owner);
        vault.setTakeProfitTier(0, 90_000 * ONE_USDC, 5_000); // sell 50% of B2 above $90k

        // price must be observed first; below trigger -> reverts.
        vm.prank(keeper);
        vault.runMonthlyEngine(80_000 * ONE_USDC);
        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedDynaVault.TakeProfitNotTriggered.selector, 90_000 * ONE_USDC, 80_000 * ONE_USDC
            )
        );
        vault.executeTakeProfit(0);

        // price above trigger -> executes, moves 50% of B2 into idle.
        vm.prank(keeper);
        vault.runMonthlyEngine(95_000 * ONE_USDC);
        uint256 idleBefore = usdc.balanceOf(address(vault));
        vm.prank(keeper);
        vault.executeTakeProfit(0);

        assertApproxEqAbs(b2.totalAssets(), b2Before / 2, 2);
        assertGt(usdc.balanceOf(address(vault)), idleBefore);
    }

    function test_executeTakeProfit_revertsWhenTierUnset() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.TierNotSet.selector, 3));
        vault.executeTakeProfit(3);
    }

    function test_resetTakeProfitTier() public {
        vm.startPrank(owner);
        vault.setTakeProfitTier(1, 100_000 * ONE_USDC, 3_000);
        vault.resetTakeProfitTier(1);
        vm.stopPrank();
        (,, bool set) = vault.takeProfitTiers(1);
        assertFalse(set);
    }

    /* ------------------------------- curtailment ------------------------------ */

    function test_curtailment_triggeredByLowPriceInEngine() public {
        vm.startPrank(owner);
        vault.setCurtailmentThresholds(35_968 * ONE_USDC, 72_318 * ONE_USDC);
        vault.setHalvingMonth(21);
        vm.stopPrank();

        // month 1, pre-halving threshold 35_968; price below -> curtail.
        vm.prank(keeper);
        vm.expectEmit(false, false, false, true, address(vault));
        emit CurtailmentTriggered(1, 30_000 * ONE_USDC, 35_968 * ONE_USDC);
        vault.runMonthlyEngine(30_000 * ONE_USDC);
        assertTrue(vault.isCurtailed());

        // price recovers -> lifted.
        vm.prank(keeper);
        vault.runMonthlyEngine(40_000 * ONE_USDC);
        assertFalse(vault.isCurtailed());
    }

    function test_curtail_blocksNewB1Allocation() public {
        // manual curtail (owner or keeper)
        vm.prank(keeper);
        vault.curtail();
        assertTrue(vault.isCurtailed());

        // deposit while curtailed: B1 gets nothing, its share stays idle.
        vm.prank(alice);
        vault.deposit(100_000 * ONE_USDC, alice);
        assertEq(b1.totalAssets(), 0);
        // B2 still funded.
        assertGt(b2.totalAssets(), 0);
    }

    function test_curtail_ownerOrKeeperOnly() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotKeeper.selector, stranger));
        vault.curtail();
    }

    function test_liftCurtailment() public {
        vm.prank(keeper);
        vault.curtail();
        vm.prank(owner);
        vault.liftCurtailment();
        assertFalse(vault.isCurtailed());
    }

    /* ------------------------------ config setters ---------------------------- */

    function test_setters_ownerOnly() public {
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setKeeper(stranger);
        vm.stopPrank();
    }

    function test_setKeeper_rotatesRole() public {
        address newKeeper = makeAddr("newKeeper");
        vm.prank(owner);
        vault.setKeeper(newKeeper);
        assertEq(vault.keeper(), newKeeper);
        // old keeper loses power.
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotKeeper.selector, keeper));
        vault.rebalance();
    }

    function test_setProductDuration_andVendingCurve() public {
        vm.prank(owner);
        vault.setProductDurationMonths(24);
        assertEq(vault.vendingCurveBps(0), 10_000); // month 0: 100%
        assertEq(vault.vendingCurveBps(12), 5_000); // month 12: 50%
        assertEq(vault.vendingCurveBps(24), 0); // expiry: 0%
        assertEq(vault.vendingCurveBps(30), 0); // past expiry clamps to 0
    }

    /* ---------------------------------- fuzz ---------------------------------- */

    function testFuzz_convertRoundTrip(uint256 assets) public {
        assets = bound(assets, 1, 1_000_000 * ONE_USDC);
        vm.prank(alice);
        uint256 s = vault.deposit(assets, alice);
        // round-trip: shares back to assets never inflates the position.
        uint256 back = vault.convertToAssets(s);
        assertLe(back, assets);
        assertApproxEqAbs(back, assets, 1);
    }

    function testFuzz_depositRedeem_neverExtractsMoreThanDeposited(uint256 amount) public {
        amount = bound(amount, 1, 4_000_000 * ONE_USDC);
        vm.prank(alice);
        uint256 s = vault.deposit(amount, alice);
        vm.prank(alice);
        uint256 out = vault.redeem(s, alice, alice);
        assertLe(out, amount);
        assertApproxEqAbs(out, amount, 3); // integer allocation rounding
    }

    function testFuzz_depositAllocationConserved(uint256 amount) public {
        amount = bound(amount, 100 * ONE_USDC, 4_000_000 * ONE_USDC);
        vm.prank(alice);
        vault.deposit(amount, alice);
        // idle + B1 + B2 == total deposited (no assets created or lost).
        uint256 idle = usdc.balanceOf(address(vault));
        assertEq(idle + b1.totalAssets() + b2.totalAssets(), amount);
    }

    function testFuzz_setStrategyAllocation_onlyKeeper(address caller) public {
        vm.assume(caller != keeper);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotKeeper.selector, caller));
        vault.setStrategyAllocation(0, 1_000);
    }

    function testFuzz_nonWhitelistedNeverDeposits(address caller) public {
        vm.assume(caller != alice && caller != bob && caller != address(0));
        usdc.mint(caller, 1_000 * ONE_USDC);
        vm.prank(caller);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(PermissionedDynaVault.NotWhitelisted.selector, caller));
        vault.deposit(1_000 * ONE_USDC, caller);
    }
}
